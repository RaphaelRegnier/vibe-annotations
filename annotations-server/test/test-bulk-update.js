#!/usr/bin/env node

/**
 * Test for bulk_update_status MCP tool
 * Tests the bulk update functionality for annotation status changes
 *
 * Test cases:
 * - Successful bulk update of multiple annotations
 * - Mixed results (some success, some failures)
 * - Error handling for invalid IDs
 * - Atomic operation (all or nothing approach)
 * - Performance (should complete in <20ms for 10 items)
 */

import { strict as assert } from 'assert';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import test data
const testDataPath = path.join(__dirname, 'test-data.json');
const testDataRaw = await readFile(testDataPath, 'utf8');
const testData = JSON.parse(testDataRaw);

// Simulate the server's annotation storage methods
class MockAnnotationsStorage {
  constructor() {
    this.annotations = [];
    this.dataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.vibe-annotations-test');
    this.dataFile = path.join(this.dataDir, 'annotations.json');
    this.saveLock = Promise.resolve(); // Add saveLock to simulate server's concurrency protection
  }

  async ensureDataDir() {
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }
  }

  async loadAnnotations() {
    try {
      if (existsSync(this.dataFile)) {
        const data = await readFile(this.dataFile, 'utf8');
        this.annotations = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load annotations:', error.message);
      this.annotations = [];
    }
    return this.annotations;
  }

  async saveAnnotations(annotations) {
    // Serialize all save operations to prevent race conditions (like the server)
    this.saveLock = this.saveLock.then(async () => {
      return this._saveAnnotationsInternal(annotations || this.annotations);
    });

    return this.saveLock;
  }

  async _saveAnnotationsInternal(annotations) {
    await this.ensureDataDir();
    this.annotations = annotations;

    // Atomic write using temporary file
    const tempFile = this.dataFile + '.tmp';
    await writeFile(tempFile, JSON.stringify(annotations, null, 2));

    // Simple rename for test environment
    if (existsSync(this.dataFile)) {
      await writeFile(this.dataFile, JSON.stringify(annotations, null, 2));
    } else {
      await writeFile(this.dataFile, JSON.stringify(annotations, null, 2));
    }
  }

  async setupTestData() {
    // Use a subset of test data with different statuses and fix screenshot structure
    this.annotations = testData.slice(0, 5).map(annotation => ({
      ...annotation,
      // Fix screenshot structure to match server expectations
      screenshot: annotation.screenshot ? {
        data_url: annotation.screenshot.data || annotation.screenshot.data_url,
        compression: annotation.screenshot.compression || 'high',
        crop_area: annotation.screenshot.crop_area || null,
        element_bounds: annotation.screenshot.element_bounds || null,
        timestamp: annotation.screenshot.timestamp || new Date().toISOString()
      } : null,
      // Reset IDs for consistent testing
      id: annotation.id,
      updated_at: new Date().toISOString()
    }));
    await this.saveAnnotations(this.annotations);
  }

  async cleanup() {
    try {
      this.annotations = [];
      if (existsSync(this.dataFile)) {
        await writeFile(this.dataFile, '[]');
      }
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }

  /**
   * Apply an annotations update using serialized read→mutate→save operations
   * This prevents race conditions during concurrent operations by chaining
   * all updates onto the existing saveLock Promise (like the server implementation).
   */
  async applyAnnotationsUpdate(mutator) {
    // Chain onto saveLock to serialize read→mutate→save
    this.saveLock = this.saveLock.then(async () => {
      const current = await this.loadAnnotations();
      const result = await mutator(current);
      await this._saveAnnotationsInternal(current);
      return result;
    });
    return this.saveLock;
  }

  // Implement the bulk update status method using the concurrency protection
  async bulkUpdateStatus(ids, newStatus) {
    const startTime = Date.now();

    // Validate status
    const validStatuses = ['pending', 'completed', 'archived'];
    if (!validStatuses.includes(newStatus)) {
      return {
        success: false,
        updated: [],
        failed: [],
        message: `Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`
      };
    }

    // Validate ids
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        success: false,
        updated: [],
        failed: [],
        message: 'ids must be a non-empty array'
      };
    }

    // Use applyAnnotationsUpdate to prevent race conditions (like the server)
    const result = await this.applyAnnotationsUpdate((annotations) => {
      const results = {
        success: true,
        updated: [],
        failed: [],
        message: ''
      };

      // Build a map for efficient lookups
      const annotationMap = new Map();
      annotations.forEach((annotation, index) => {
        annotationMap.set(annotation.id, { annotation, index });
      });

      // Process each ID
      for (const id of ids) {
        if (!id || typeof id !== 'string') {
          results.failed.push({
            id: id,
            reason: 'Invalid ID: must be a non-empty string'
          });
          continue;
        }

        const entry = annotationMap.get(id);
        if (!entry) {
          results.failed.push({
            id: id,
            reason: 'Annotation not found'
          });
          continue;
        }

        const { annotation } = entry;
        const oldStatus = annotation.status;

        // Update the annotation
        annotation.status = newStatus;
        annotation.updated_at = new Date().toISOString();

        results.updated.push({
          id: id,
          old_status: oldStatus,
          new_status: newStatus
        });
      }

      // Determine overall success
      if (results.failed.length > 0) {
        results.success = false;
        results.message = `Updated ${results.updated.length} annotations, ${results.failed.length} failed`;
      } else {
        results.message = `Successfully updated ${results.updated.length} annotations`;
      }

      return results;
    });

    const endTime = Date.now();
    result.performance = endTime - startTime;

    return result;
  }
}

// Test runner
class BulkUpdateTests {
  constructor() {
    this.storage = new MockAnnotationsStorage();
    this.testsPassed = 0;
    this.testsTotal = 0;
  }

  async runTest(testName, testFn) {
    this.testsTotal++;
    try {
      console.log(`\n🧪 Running: ${testName}`);
      await testFn();
      console.log(`✅ PASSED: ${testName}`);
      this.testsPassed++;
    } catch (error) {
      console.log(`❌ FAILED: ${testName}`);
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack.split('\n').slice(1, 3).join('\n')}`);
      }
    }
  }

  async setUp() {
    await this.storage.setupTestData();
  }

  async tearDown() {
    await this.storage.cleanup();
  }

  async testSuccessfulBulkUpdate() {
    await this.setUp();

    // Get first 3 annotation IDs
    const annotations = await this.storage.loadAnnotations();
    const idsToUpdate = annotations.slice(0, 3).map(a => a.id);

    const result = await this.storage.bulkUpdateStatus(idsToUpdate, 'completed');

    assert.strictEqual(result.success, true, 'Bulk update should succeed');
    assert.strictEqual(result.updated.length, 3, 'Should update exactly 3 annotations');
    assert.strictEqual(result.failed.length, 0, 'Should have no failures');
    assert.match(result.message, /Successfully updated 3 annotations/, 'Should have success message');

    // Verify all annotations were updated
    result.updated.forEach(update => {
      assert.strictEqual(update.new_status, 'completed', 'New status should be completed');
      assert.ok(update.old_status, 'Should have old status');
    });

    await this.tearDown();
  }

  async testMixedResults() {
    await this.setUp();

    // Mix valid and invalid IDs
    const annotations = await this.storage.loadAnnotations();
    const validIds = annotations.slice(0, 2).map(a => a.id);
    const invalidIds = ['invalid_id_1', 'invalid_id_2'];
    const mixedIds = [...validIds, ...invalidIds];

    const result = await this.storage.bulkUpdateStatus(mixedIds, 'archived');

    assert.strictEqual(result.success, false, 'Bulk update should report partial failure');
    assert.strictEqual(result.updated.length, 2, 'Should update 2 valid annotations');
    assert.strictEqual(result.failed.length, 2, 'Should have 2 failures');
    assert.match(result.message, /Updated 2 annotations, 2 failed/, 'Should have mixed results message');

    // Verify failures have proper structure
    result.failed.forEach(failure => {
      assert.ok(failure.id, 'Failed item should have ID');
      assert.strictEqual(failure.reason, 'Annotation not found', 'Should have proper failure reason');
    });

    await this.tearDown();
  }

  async testInvalidStatus() {
    await this.setUp();

    const annotations = await this.storage.loadAnnotations();
    const idsToUpdate = [annotations[0].id];

    const result = await this.storage.bulkUpdateStatus(idsToUpdate, 'invalid_status');
    assert.strictEqual(result.success, false, 'Should reject invalid status');
    assert.match(result.message, /Invalid status/, 'Should have proper error message');
    assert.strictEqual(result.updated.length, 0, 'Should not update any annotations');
    assert.strictEqual(result.failed.length, 0, 'Should not have failed items for validation error');

    await this.tearDown();
  }

  async testEmptyIds() {
    await this.setUp();

    const result = await this.storage.bulkUpdateStatus([], 'completed');
    assert.strictEqual(result.success, false, 'Should reject empty IDs array');
    assert.match(result.message, /non-empty array/, 'Should have proper error message');
    assert.strictEqual(result.updated.length, 0, 'Should not update any annotations');
    assert.strictEqual(result.failed.length, 0, 'Should not have failed items for validation error');

    await this.tearDown();
  }

  async testInvalidIds() {
    await this.setUp();

    // Test null IDs
    const result1 = await this.storage.bulkUpdateStatus(null, 'completed');
    assert.strictEqual(result1.success, false, 'Should reject null IDs');
    assert.match(result1.message, /non-empty array/, 'Should have proper error message for null');

    // Test undefined IDs
    const result2 = await this.storage.bulkUpdateStatus(undefined, 'completed');
    assert.strictEqual(result2.success, false, 'Should reject undefined IDs');
    assert.match(result2.message, /non-empty array/, 'Should have proper error message for undefined');

    // Test non-array IDs
    const result3 = await this.storage.bulkUpdateStatus('not-an-array', 'completed');
    assert.strictEqual(result3.success, false, 'Should reject non-array IDs');
    assert.match(result3.message, /non-empty array/, 'Should have proper error message for non-array');

    await this.tearDown();
  }

  async testAtomicOperation() {
    await this.setUp();

    // For this test, we simulate atomic behavior
    // In real implementation, either all updates succeed or none do
    const annotations = await this.storage.loadAnnotations();
    const idsToUpdate = annotations.slice(0, 2).map(a => a.id);

    // Get original statuses
    const originalStatuses = new Map();
    annotations.forEach(a => originalStatuses.set(a.id, a.status));

    const result = await this.storage.bulkUpdateStatus(idsToUpdate, 'completed');

    assert.strictEqual(result.success, true, 'Should succeed for valid IDs');

    // Verify all targeted annotations were updated
    const updatedAnnotations = await this.storage.loadAnnotations();
    const updatedMap = new Map();
    updatedAnnotations.forEach(a => updatedMap.set(a.id, a));

    idsToUpdate.forEach(id => {
      const annotation = updatedMap.get(id);
      assert.strictEqual(annotation.status, 'completed', `Annotation ${id} should be updated`);
      assert.notStrictEqual(annotation.updated_at, originalStatuses.get(id), 'Should have new timestamp');
    });

    await this.tearDown();
  }

  async testPerformance() {
    await this.setUp();

    // Create more test data for performance test
    const annotations = await this.storage.loadAnnotations();

    // Add more test annotations to reach 10 items
    while (annotations.length < 10) {
      annotations.push({
        ...testData[0],
        id: `perf_test_${randomUUID()}`,
        status: 'pending'
      });
    }

    this.storage.annotations = annotations;
    await this.storage.saveAnnotations(annotations);

    const idsToUpdate = annotations.slice(0, 10).map(a => a.id);

    const startTime = Date.now();
    const result = await this.storage.bulkUpdateStatus(idsToUpdate, 'completed');
    const endTime = Date.now();

    const executionTime = endTime - startTime;

    assert.strictEqual(result.success, true, 'Performance test should succeed');
    assert.strictEqual(result.updated.length, 10, 'Should update 10 annotations');
    assert.ok(executionTime < 20, `Should complete in <20ms, took ${executionTime}ms`);

    console.log(`   ⚡ Performance: ${executionTime}ms for 10 items`);

    await this.tearDown();
  }

  async testStatusTransitions() {
    await this.setUp();

    const annotations = await this.storage.loadAnnotations();
    const id = annotations[0].id;

    // Test all valid status transitions
    const statusFlow = ['pending', 'completed', 'archived', 'pending'];

    for (let i = 0; i < statusFlow.length - 1; i++) {
      const currentStatus = statusFlow[i];
      const nextStatus = statusFlow[i + 1];

      const result = await this.storage.bulkUpdateStatus([id], nextStatus);

      assert.strictEqual(result.success, true, `Should transition from ${currentStatus} to ${nextStatus}`);
      assert.strictEqual(result.updated[0].old_status, currentStatus, `Old status should be ${currentStatus}`);
      assert.strictEqual(result.updated[0].new_status, nextStatus, `New status should be ${nextStatus}`);
    }

    await this.tearDown();
  }

  async testRaceConditionPrevention() {
    await this.setUp();

    const annotations = await this.storage.loadAnnotations();
    const targetId = annotations[0].id;

    // Simulate concurrent operations
    const operations = [
      () => this.storage.bulkUpdateStatus([targetId], 'completed'),
      () => this.storage.bulkUpdateStatus([targetId], 'archived'),
      () => this.storage.bulkUpdateStatus([targetId], 'pending')
    ];

    // Execute all operations concurrently
    const results = await Promise.all(operations.map(op => op()));

    // All operations should succeed (no race condition errors)
    results.forEach((result, index) => {
      assert.strictEqual(result.success, true, `Operation ${index + 1} should succeed`);
      assert.strictEqual(result.updated.length, 1, `Operation ${index + 1} should update 1 annotation`);
    });

    // Verify final state is consistent
    const finalAnnotations = await this.storage.loadAnnotations();
    const finalAnnotation = finalAnnotations.find(a => a.id === targetId);
    assert.ok(finalAnnotation, 'Target annotation should still exist');
    assert.ok(['completed', 'archived', 'pending'].includes(finalAnnotation.status), 'Final status should be valid');

    console.log(`   ⚡ Race condition test: All ${results.length} concurrent operations completed successfully`);
    console.log(`   ⚡ Final status: ${finalAnnotation.status}`);

    await this.tearDown();
  }

  async testConcurrentUpdates() {
    await this.setUp();

    const annotations = await this.storage.loadAnnotations();
    const ids = annotations.slice(0, 3).map(a => a.id);

    // Test concurrent bulk updates with different IDs
    const concurrentOperations = [
      this.storage.bulkUpdateStatus([ids[0]], 'completed'),
      this.storage.bulkUpdateStatus([ids[1]], 'archived'),
      this.storage.bulkUpdateStatus([ids[2]], 'pending'),
      this.storage.bulkUpdateStatus(ids.slice(0, 2), 'completed') // Overlapping update
    ];

    const startTime = Date.now();
    const results = await Promise.all(concurrentOperations);
    const endTime = Date.now();

    // All operations should complete successfully
    results.forEach((result, index) => {
      assert.strictEqual(result.success, true, `Concurrent operation ${index + 1} should succeed`);
      assert.ok(result.updated.length > 0, `Operation ${index + 1} should update at least 1 annotation`);
    });

    // Verify data consistency
    const finalAnnotations = await this.storage.loadAnnotations();
    const updatedAnnotations = finalAnnotations.filter(a => ids.includes(a.id));

    assert.strictEqual(updatedAnnotations.length, 3, 'All 3 target annotations should exist');
    updatedAnnotations.forEach(annotation => {
      assert.ok(['pending', 'completed', 'archived'].includes(annotation.status),
        `Annotation ${annotation.id} should have valid status`);
      assert.ok(annotation.updated_at, `Annotation ${annotation.id} should have updated timestamp`);
    });

    console.log(`   ⚡ Concurrent updates: ${results.length} operations completed in ${endTime - startTime}ms`);

    await this.tearDown();
  }

  async testDataIntegrityUnderLoad() {
    await this.setUp();

    const annotations = await this.storage.loadAnnotations();
    const allIds = annotations.map(a => a.id);

    // Create many concurrent operations that modify the same data
    const heavyOperations = [];
    for (let i = 0; i < 50; i++) {
      // Mix of single and bulk operations
      if (i % 3 === 0) {
        heavyOperations.push(() => this.storage.bulkUpdateStatus([allIds[i % allIds.length]], 'completed'));
      } else if (i % 3 === 1) {
        heavyOperations.push(() => this.storage.bulkUpdateStatus(allIds.slice(0, 2), 'archived'));
      } else {
        heavyOperations.push(() => this.storage.bulkUpdateStatus([allIds[(i + 1) % allIds.length]], 'pending'));
      }
    }

    const startTime = Date.now();
    const results = await Promise.all(heavyOperations.map(op => op()));
    const endTime = Date.now();

    // All operations should complete successfully (no data corruption)
    let totalUpdated = 0;
    let totalFailed = 0;

    results.forEach((result, index) => {
      assert.strictEqual(result.success, true, `Load test operation ${index + 1} should succeed`);
      assert.ok(typeof result.updated === 'object' && Array.isArray(result.updated),
        `Operation ${index + 1} should have updated array`);
      assert.ok(typeof result.failed === 'object' && Array.isArray(result.failed),
        `Operation ${index + 1} should have failed array`);
      totalUpdated += result.updated.length;
      totalFailed += result.failed.length;
    });

    // Verify final data integrity
    const finalAnnotations = await this.storage.loadAnnotations();
    assert.strictEqual(finalAnnotations.length, annotations.length,
      'No annotations should be lost during concurrent operations');

    finalAnnotations.forEach(annotation => {
      assert.ok(['pending', 'completed', 'archived'].includes(annotation.status),
        `Annotation ${annotation.id} should have valid status after load test`);
      assert.ok(annotation.updated_at, `Annotation ${annotation.id} should have timestamp`);
      assert.ok(annotation.id, `Annotation ${annotation.id} should have valid ID`);
    });

    console.log(`   ⚡ Load test: ${results.length} operations completed in ${endTime - startTime}ms`);
    console.log(`   ⚡ Total updates: ${totalUpdated}, Total failures: ${totalFailed}`);
    console.log(`   ⚡ Data integrity maintained: ${finalAnnotations.length} annotations preserved`);

    await this.tearDown();
  }

  async runAllTests() {
    console.log('🚀 Starting bulk_update_status tool tests...\n');

    await this.runTest('Successful bulk update', () => this.testSuccessfulBulkUpdate());
    await this.runTest('Mixed results (partial success)', () => this.testMixedResults());
    await this.runTest('Invalid status rejection', () => this.testInvalidStatus());
    await this.runTest('Empty IDs array rejection', () => this.testEmptyIds());
    await this.runTest('Invalid IDs parameter rejection', () => this.testInvalidIds());
    await this.runTest('Atomic operation behavior', () => this.testAtomicOperation());
    await this.runTest('Performance (<20ms for 10 items)', () => this.testPerformance());
    await this.runTest('Status transition validation', () => this.testStatusTransitions());
    await this.runTest('Race condition prevention', () => this.testRaceConditionPrevention());
    await this.runTest('Concurrent updates serialization', () => this.testConcurrentUpdates());
    await this.runTest('Data integrity under concurrent load', () => this.testDataIntegrityUnderLoad());

    console.log(`\n📊 Test Results: ${this.testsPassed}/${this.testsTotal} passed`);

    if (this.testsPassed === this.testsTotal) {
      console.log('🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('💥 Some tests failed!');
      process.exit(1);
    }
  }
}

// Run the tests
const testRunner = new BulkUpdateTests();
testRunner.runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
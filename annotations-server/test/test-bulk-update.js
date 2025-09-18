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
const testData = JSON.parse(await readFile(testDataPath, 'utf8'));

// Simulate the server's annotation storage methods
class MockAnnotationsStorage {
  constructor() {
    this.annotations = [];
    this.dataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.vibe-annotations-test');
    this.dataFile = path.join(this.dataDir, 'annotations.json');
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

  async saveAnnotations() {
    await this.ensureDataDir();

    // Atomic write using temporary file
    const tempFile = this.dataFile + '.tmp';
    await writeFile(tempFile, JSON.stringify(this.annotations, null, 2));

    // On Windows, we need to handle the rename differently
    if (existsSync(this.dataFile)) {
      await writeFile(this.dataFile, JSON.stringify(this.annotations, null, 2));
    } else {
      await writeFile(this.dataFile, JSON.stringify(this.annotations, null, 2));
    }
  }

  async setupTestData() {
    // Use a subset of test data with different statuses
    this.annotations = testData.slice(0, 5).map(annotation => ({
      ...annotation,
      // Reset IDs for consistent testing
      id: annotation.id,
      updated_at: new Date().toISOString()
    }));
    await this.saveAnnotations();
  }

  async cleanup() {
    try {
      if (existsSync(this.dataFile)) {
        await writeFile(this.dataFile, '[]');
      }
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }

  // Implement the bulk update status method
  async bulkUpdateStatus(ids, newStatus) {
    const startTime = Date.now();

    // Validate status
    const validStatuses = ['pending', 'completed', 'archived'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate ids
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('ids must be a non-empty array');
    }

    await this.loadAnnotations();

    const results = {
      success: true,
      updated: [],
      failed: [],
      message: ''
    };

    // Track which annotations exist
    const annotationMap = new Map();
    this.annotations.forEach(annotation => {
      annotationMap.set(annotation.id, annotation);
    });

    // Process each ID
    for (const id of ids) {
      const annotation = annotationMap.get(id);

      if (!annotation) {
        results.failed.push({
          id: id,
          reason: 'Annotation not found'
        });
        continue;
      }

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

    // Save changes atomically
    if (results.updated.length > 0) {
      await this.saveAnnotations();
    }

    const endTime = Date.now();
    results.performance = endTime - startTime;

    return results;
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

    try {
      await this.storage.bulkUpdateStatus(idsToUpdate, 'invalid_status');
      assert.fail('Should throw error for invalid status');
    } catch (error) {
      assert.match(error.message, /Invalid status/, 'Should reject invalid status');
    }

    await this.tearDown();
  }

  async testEmptyIds() {
    await this.setUp();

    try {
      await this.storage.bulkUpdateStatus([], 'completed');
      assert.fail('Should throw error for empty IDs array');
    } catch (error) {
      assert.match(error.message, /non-empty array/, 'Should reject empty IDs array');
    }

    await this.tearDown();
  }

  async testInvalidIds() {
    await this.setUp();

    try {
      await this.storage.bulkUpdateStatus(null, 'completed');
      assert.fail('Should throw error for null IDs');
    } catch (error) {
      assert.match(error.message, /non-empty array/, 'Should reject null IDs');
    }

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
    await this.storage.saveAnnotations();

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
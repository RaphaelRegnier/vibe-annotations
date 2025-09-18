#!/usr/bin/env node

/**
 * Test for update_annotation_status MCP tool
 *
 * Tests the update_annotation_status tool implementation according to the contract
 * specification in specs/001-mcp-server-enhancement/contracts/mcp-tools.json
 *
 * Usage: node test-status-update.js
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_DATA_FILE = path.join(__dirname, 'test-data.json');
const TEMP_DATA_DIR = path.join(__dirname, '.test-temp');
const TEMP_DATA_FILE = path.join(TEMP_DATA_DIR, 'annotations.json');

class StatusUpdateTest {
  constructor() {
    this.testData = null;
    this.mockServer = null;
    this.testResults = [];
  }

  /**
   * Load test data and setup temporary test environment
   */
  async setup() {
    console.log('🔧 Setting up test environment...');

    // Load test data
    const testDataContent = await readFile(TEST_DATA_FILE, 'utf8');
    this.testData = JSON.parse(testDataContent);

    // Create temp directory
    if (!existsSync(TEMP_DATA_DIR)) {
      await mkdir(TEMP_DATA_DIR, { recursive: true });
    }

    console.log(`✅ Loaded ${this.testData.length} test annotations`);
  }

  /**
   * Reset test data to original state
   */
  async resetTestData() {
    await writeFile(TEMP_DATA_FILE, JSON.stringify(this.testData, null, 2));
  }

  /**
   * Load annotations from temp file
   */
  async loadAnnotations() {
    if (!existsSync(TEMP_DATA_FILE)) {
      return [];
    }
    const content = await readFile(TEMP_DATA_FILE, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Save annotations to temp file (simulates server saveAnnotations method)
   */
  async saveAnnotations(annotations) {
    await writeFile(TEMP_DATA_FILE, JSON.stringify(annotations, null, 2));
  }

  /**
   * Mock implementation of update_annotation_status tool
   * This simulates what the actual server implementation should do
   */
  async updateAnnotationStatus(id, status) {
    // Validate inputs
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        message: 'Invalid annotation ID: must be a non-empty string'
      };
    }

    const validStatuses = ['pending', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        message: `Invalid status: must be one of ${validStatuses.join(', ')}`
      };
    }

    try {
      // Load current annotations
      const annotations = await this.loadAnnotations();

      // Find annotation by ID
      const annotationIndex = annotations.findIndex(a => a.id === id);

      if (annotationIndex === -1) {
        return {
          success: false,
          message: `Annotation not found: ${id}`
        };
      }

      // Update status and timestamp
      const oldStatus = annotations[annotationIndex].status;
      annotations[annotationIndex].status = status;
      annotations[annotationIndex].updated_at = new Date().toISOString();

      // Save changes
      await this.saveAnnotations(annotations);

      return {
        success: true,
        annotation: {
          id: annotations[annotationIndex].id,
          status: annotations[annotationIndex].status,
          updated_at: annotations[annotationIndex].updated_at
        },
        message: `Status updated from '${oldStatus}' to '${status}'`
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to update annotation: ${error.message}`
      };
    }
  }

  /**
   * Run a single test case
   */
  async runTest(testName, testFunction) {
    console.log(`\n🧪 Running test: ${testName}`);

    try {
      await this.resetTestData();
      const result = await testFunction();

      if (result.passed) {
        console.log(`✅ PASS: ${testName}`);
        this.testResults.push({ name: testName, status: 'PASS' });
      } else {
        console.log(`❌ FAIL: ${testName}`);
        console.log(`   Expected: ${result.expected}`);
        console.log(`   Actual: ${result.actual}`);
        this.testResults.push({ name: testName, status: 'FAIL', reason: result.reason });
      }
    } catch (error) {
      console.log(`💥 ERROR: ${testName} - ${error.message}`);
      this.testResults.push({ name: testName, status: 'ERROR', reason: error.message });
    }
  }

  /**
   * Test: Successful status update to 'completed'
   */
  async testSuccessfulUpdateToCompleted() {
    const testId = 'vibe_test_001_button_color'; // Currently 'pending' in test data
    const result = await this.updateAnnotationStatus(testId, 'completed');

    if (!result.success) {
      return {
        passed: false,
        expected: 'success: true',
        actual: `success: false, message: ${result.message}`,
        reason: 'Update should succeed'
      };
    }

    if (result.annotation.status !== 'completed') {
      return {
        passed: false,
        expected: 'status: completed',
        actual: `status: ${result.annotation.status}`,
        reason: 'Status should be updated to completed'
      };
    }

    // Verify persistence
    const annotations = await this.loadAnnotations();
    const updatedAnnotation = annotations.find(a => a.id === testId);

    if (updatedAnnotation.status !== 'completed') {
      return {
        passed: false,
        expected: 'persisted status: completed',
        actual: `persisted status: ${updatedAnnotation.status}`,
        reason: 'Status change should persist to storage'
      };
    }

    return { passed: true };
  }

  /**
   * Test: Successful status update to 'archived'
   */
  async testSuccessfulUpdateToArchived() {
    const testId = 'vibe_test_002_mobile_heading'; // Currently 'completed' in test data
    const result = await this.updateAnnotationStatus(testId, 'archived');

    if (!result.success || result.annotation.status !== 'archived') {
      return {
        passed: false,
        expected: 'status: archived',
        actual: `status: ${result.annotation?.status || 'undefined'}`,
        reason: 'Status should be updated to archived'
      };
    }

    return { passed: true };
  }

  /**
   * Test: Successful status update to 'pending'
   */
  async testSuccessfulUpdateToPending() {
    const testId = 'vibe_test_003_loading_state'; // Currently 'archived' in test data
    const result = await this.updateAnnotationStatus(testId, 'pending');

    if (!result.success || result.annotation.status !== 'pending') {
      return {
        passed: false,
        expected: 'status: pending',
        actual: `status: ${result.annotation?.status || 'undefined'}`,
        reason: 'Status should be updated to pending'
      };
    }

    return { passed: true };
  }

  /**
   * Test: Error handling for invalid annotation ID
   */
  async testInvalidAnnotationId() {
    const result = await this.updateAnnotationStatus('nonexistent_id_12345', 'completed');

    if (result.success) {
      return {
        passed: false,
        expected: 'success: false',
        actual: 'success: true',
        reason: 'Should fail for nonexistent annotation ID'
      };
    }

    if (!result.message.includes('not found')) {
      return {
        passed: false,
        expected: 'error message containing "not found"',
        actual: `message: "${result.message}"`,
        reason: 'Should provide clear error message for missing annotation'
      };
    }

    return { passed: true };
  }

  /**
   * Test: Error handling for empty annotation ID
   */
  async testEmptyAnnotationId() {
    const result = await this.updateAnnotationStatus('', 'completed');

    if (result.success) {
      return {
        passed: false,
        expected: 'success: false',
        actual: 'success: true',
        reason: 'Should fail for empty annotation ID'
      };
    }

    return { passed: true };
  }

  /**
   * Test: Error handling for null annotation ID
   */
  async testNullAnnotationId() {
    const result = await this.updateAnnotationStatus(null, 'completed');

    if (result.success) {
      return {
        passed: false,
        expected: 'success: false',
        actual: 'success: true',
        reason: 'Should fail for null annotation ID'
      };
    }

    return { passed: true };
  }

  /**
   * Test: Error handling for invalid status values
   */
  async testInvalidStatusValue() {
    const testId = 'vibe_test_001_button_color';
    const invalidStatuses = ['invalid', 'done', 'in_progress', 123, null, undefined];

    for (const invalidStatus of invalidStatuses) {
      const result = await this.updateAnnotationStatus(testId, invalidStatus);

      if (result.success) {
        return {
          passed: false,
          expected: `success: false for status "${invalidStatus}"`,
          actual: 'success: true',
          reason: `Should reject invalid status value: ${invalidStatus}`
        };
      }
    }

    return { passed: true };
  }

  /**
   * Test: Timestamp is updated on status change
   */
  async testTimestampUpdate() {
    const testId = 'vibe_test_001_button_color';

    // Get original timestamp
    const originalAnnotations = await this.loadAnnotations();
    const originalAnnotation = originalAnnotations.find(a => a.id === testId);
    const originalTimestamp = originalAnnotation.updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update status
    const result = await this.updateAnnotationStatus(testId, 'completed');

    if (!result.success) {
      return {
        passed: false,
        expected: 'successful update',
        actual: 'update failed',
        reason: result.message
      };
    }

    // Check if timestamp was updated
    if (result.annotation.updated_at <= originalTimestamp) {
      return {
        passed: false,
        expected: 'updated timestamp newer than original',
        actual: `original: ${originalTimestamp}, updated: ${result.annotation.updated_at}`,
        reason: 'Timestamp should be updated on status change'
      };
    }

    return { passed: true };
  }

  /**
   * Test: Verify response structure matches contract
   */
  async testResponseStructure() {
    const testId = 'vibe_test_001_button_color';
    const result = await this.updateAnnotationStatus(testId, 'completed');

    // Check required fields
    const requiredFields = ['success', 'annotation', 'message'];
    for (const field of requiredFields) {
      if (!(field in result)) {
        return {
          passed: false,
          expected: `field "${field}" present`,
          actual: `field "${field}" missing`,
          reason: `Response should include ${field} field`
        };
      }
    }

    // Check annotation object structure
    if (result.success) {
      const annotationFields = ['id', 'status', 'updated_at'];
      for (const field of annotationFields) {
        if (!(field in result.annotation)) {
          return {
            passed: false,
            expected: `annotation.${field} present`,
            actual: `annotation.${field} missing`,
            reason: `Annotation object should include ${field} field`
          };
        }
      }
    }

    return { passed: true };
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting update_annotation_status tool tests\n');

    await this.setup();

    // Run all test cases
    await this.runTest('Successful update to completed', () => this.testSuccessfulUpdateToCompleted());
    await this.runTest('Successful update to archived', () => this.testSuccessfulUpdateToArchived());
    await this.runTest('Successful update to pending', () => this.testSuccessfulUpdateToPending());
    await this.runTest('Invalid annotation ID', () => this.testInvalidAnnotationId());
    await this.runTest('Empty annotation ID', () => this.testEmptyAnnotationId());
    await this.runTest('Null annotation ID', () => this.testNullAnnotationId());
    await this.runTest('Invalid status values', () => this.testInvalidStatusValue());
    await this.runTest('Timestamp update', () => this.testTimestampUpdate());
    await this.runTest('Response structure', () => this.testResponseStructure());

    // Print summary
    this.printSummary();
  }

  /**
   * Print test results summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const errors = this.testResults.filter(r => r.status === 'ERROR').length;
    const total = this.testResults.length;

    console.log(`Total tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`💥 Errors: ${errors}`);

    if (failed > 0 || errors > 0) {
      console.log('\nFailed/Error tests:');
      this.testResults
        .filter(r => r.status !== 'PASS')
        .forEach(r => {
          console.log(`  ${r.status}: ${r.name} - ${r.reason || 'Unknown error'}`);
        });
    }

    console.log(`\n${passed === total ? '🎉 All tests passed!' : '⚠️  Some tests failed'}`);
    console.log('='.repeat(60));

    // Exit with appropriate code
    process.exit(failed + errors > 0 ? 1 : 0);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new StatusUpdateTest();
  test.runAllTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

export { StatusUpdateTest };
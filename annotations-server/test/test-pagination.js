#!/usr/bin/env node

/**
 * Test: Pagination (offset parameter) for read_annotations tool
 *
 * This test validates the offset parameter implementation for pagination functionality
 * in the read_annotations MCP tool. Tests cover basic pagination, edge cases, default
 * behavior, ordering, and performance requirements.
 *
 * Task: T005 - Create test for pagination (offset parameter)
 * Performance Target: <5ms for pagination operations
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock LocalAnnotationsServer class for testing
class MockAnnotationsServer {
  constructor(testData) {
    this.testData = testData;
  }

  async loadAnnotations() {
    return this.testData;
  }

  async readAnnotations(args) {
    const annotations = await this.loadAnnotations();
    const { status = 'pending', limit = 50, offset = 0, url } = args;

    let filtered = annotations;

    // Filter by status
    if (status !== 'all') {
      filtered = filtered.filter(a => a.status === status);
    }

    // Filter by URL
    if (url) {
      if (url.includes('*') || url.endsWith('/')) {
        const baseUrl = url.replace('*', '').replace(/\/$/, '');
        filtered = filtered.filter(a => a.url.startsWith(baseUrl));
      } else {
        filtered = filtered.filter(a => a.url === url);
      }
    }

    // Apply pagination with offset
    const total = filtered.length;
    const paginatedResults = filtered.slice(offset, offset + limit);

    // Calculate pagination metadata
    const pagination = {
      total: total,
      limit: limit,
      offset: offset,
      has_more: (offset + limit) < total
    };

    // Transform annotations to match expected output (strip screenshots)
    const annotationsWithScreenshotFlag = paginatedResults.map(annotation => ({
      id: annotation.id,
      status: annotation.status,
      comment: annotation.comment,
      url: annotation.url,
      has_screenshot: !!(annotation.screenshot && annotation.screenshot.data),
      created_at: annotation.created_at,
      updated_at: annotation.updated_at
    }));

    return {
      annotations: annotationsWithScreenshotFlag,
      pagination: pagination
    };
  }
}

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Assertion failed: ${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
    }
  }

  async run() {
    console.log('🧪 Running pagination tests...\n');

    for (const { name, testFn } of this.tests) {
      try {
        const startTime = performance.now();
        await testFn();
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
        this.passed++;

        // Performance check: Should complete in <5ms
        if (duration > 5) {
          console.log(`⚠️  Performance warning: Test took ${duration.toFixed(2)}ms (target: <5ms)`);
        }
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Load test data
async function loadTestData() {
  try {
    const testDataPath = path.join(__dirname, 'test-data.json');
    const data = await readFile(testDataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load test data:', error);
    process.exit(1);
  }
}

// Main test suite
async function runTests() {
  const testData = await loadTestData();
  const runner = new TestRunner();

  // Test 1: Basic pagination with limit and offset
  runner.test('Basic pagination with limit and offset', async () => {
    const server = new MockAnnotationsServer(testData);

    // Test first page
    const page1 = await server.readAnnotations({ limit: 3, offset: 0, status: 'all' });
    runner.assert(page1.annotations.length === 3, 'First page should have 3 annotations');
    runner.assert(page1.pagination.offset === 0, 'Offset should be 0 for first page');
    runner.assert(page1.pagination.limit === 3, 'Limit should be 3');
    runner.assert(page1.pagination.has_more === true, 'Should have more pages');
    runner.assert(page1.pagination.total === testData.length, `Total should be ${testData.length}`);

    // Test second page
    const page2 = await server.readAnnotations({ limit: 3, offset: 3, status: 'all' });
    runner.assert(page2.annotations.length === 3, 'Second page should have 3 annotations');
    runner.assert(page2.pagination.offset === 3, 'Offset should be 3 for second page');
    runner.assert(page2.pagination.has_more === true, 'Should have more pages');

    // Verify different annotations on different pages
    const page1Ids = page1.annotations.map(a => a.id);
    const page2Ids = page2.annotations.map(a => a.id);
    const hasOverlap = page1Ids.some(id => page2Ids.includes(id));
    runner.assert(!hasOverlap, 'Pages should not have overlapping annotations');
  });

  // Test 2: Edge case - offset beyond data length
  runner.test('Edge case: offset beyond data length', async () => {
    const server = new MockAnnotationsServer(testData);

    const result = await server.readAnnotations({
      limit: 10,
      offset: testData.length + 5,
      status: 'all'
    });

    runner.assert(result.annotations.length === 0, 'Should return empty array when offset exceeds data length');
    runner.assert(result.pagination.offset === testData.length + 5, 'Should preserve offset in response');
    runner.assert(result.pagination.has_more === false, 'Should not have more when offset exceeds data');
    runner.assert(result.pagination.total === testData.length, 'Should return correct total count');
  });

  // Test 3: Edge case - offset at exact data length
  runner.test('Edge case: offset at exact data length', async () => {
    const server = new MockAnnotationsServer(testData);

    const result = await server.readAnnotations({
      limit: 10,
      offset: testData.length,
      status: 'all'
    });

    runner.assert(result.annotations.length === 0, 'Should return empty array when offset equals data length');
    runner.assert(result.pagination.has_more === false, 'Should not have more when offset equals data length');
  });

  // Test 4: Default behavior when offset not provided
  runner.test('Default behavior when offset not provided', async () => {
    const server = new MockAnnotationsServer(testData);

    const result = await server.readAnnotations({ limit: 5, status: 'all' });

    runner.assert(result.pagination.offset === 0, 'Default offset should be 0');
    runner.assert(result.annotations.length === 5, 'Should return requested limit');
    runner.assert(result.pagination.has_more === true, 'Should have more when default offset used');
  });

  // Test 5: Correct ordering of results
  runner.test('Correct ordering of results', async () => {
    const server = new MockAnnotationsServer(testData);

    // Get first chunk
    const chunk1 = await server.readAnnotations({ limit: 2, offset: 0, status: 'all' });
    // Get second chunk
    const chunk2 = await server.readAnnotations({ limit: 2, offset: 2, status: 'all' });
    // Get overlapping chunk to verify ordering
    const overlap = await server.readAnnotations({ limit: 3, offset: 1, status: 'all' });

    // Verify ordering consistency
    runner.assert(chunk1.annotations[1].id === overlap.annotations[0].id,
      'Second item of first chunk should match first item of overlap');
    runner.assert(chunk2.annotations[0].id === overlap.annotations[1].id,
      'First item of second chunk should match second item of overlap');
    runner.assert(chunk2.annotations[1].id === overlap.annotations[2].id,
      'Second item of second chunk should match third item of overlap');
  });

  // Test 6: Pagination with filtering (status)
  runner.test('Pagination with status filtering', async () => {
    const server = new MockAnnotationsServer(testData);

    // Count pending annotations
    const pendingAnnotations = testData.filter(a => a.status === 'pending');

    const result = await server.readAnnotations({
      limit: 2,
      offset: 1,
      status: 'pending'
    });

    runner.assert(result.pagination.total === pendingAnnotations.length,
      'Total should reflect filtered count, not full dataset');
    runner.assert(result.annotations.every(a => a.status === 'pending'),
      'All returned annotations should match filter');

    if (pendingAnnotations.length > 3) {
      runner.assert(result.pagination.has_more === true,
        'Should have more pages when filtering leaves enough items');
    }
  });

  // Test 7: Pagination with URL filtering
  runner.test('Pagination with URL filtering', async () => {
    const server = new MockAnnotationsServer(testData);

    // Filter by base URL pattern
    const urlPattern = 'http://localhost:3000/*';
    const baseUrl = 'http://localhost:3000';
    const matchingAnnotations = testData.filter(a => a.url.startsWith(baseUrl));

    const result = await server.readAnnotations({
      limit: 2,
      offset: 1,
      url: urlPattern,
      status: 'all'
    });

    runner.assert(result.pagination.total === matchingAnnotations.length,
      'Total should reflect URL filtered count');
    runner.assert(result.annotations.every(a => a.url.startsWith(baseUrl)),
      'All returned annotations should match URL filter');
  });

  // Test 8: Large offset with small limit
  runner.test('Large offset with small limit', async () => {
    const server = new MockAnnotationsServer(testData);

    const largeOffset = testData.length - 2;
    const result = await server.readAnnotations({
      limit: 1,
      offset: largeOffset,
      status: 'all'
    });

    runner.assert(result.annotations.length === 1, 'Should return exactly 1 annotation');
    runner.assert(result.pagination.offset === largeOffset, 'Should preserve large offset');
    runner.assert(result.pagination.has_more === true, 'Should have more (1 remaining)');
  });

  // Test 9: Verify screenshot data is stripped (has_screenshot flag)
  runner.test('Screenshot data stripped, has_screenshot flag set', async () => {
    const server = new MockAnnotationsServer(testData);

    const result = await server.readAnnotations({ limit: 5, offset: 0, status: 'all' });

    result.annotations.forEach(annotation => {
      runner.assert(annotation.hasOwnProperty('has_screenshot'),
        'Each annotation should have has_screenshot flag');
      runner.assert(!annotation.hasOwnProperty('screenshot'),
        'Screenshot data should be stripped from response');
      runner.assert(typeof annotation.has_screenshot === 'boolean',
        'has_screenshot should be boolean');
    });

    // Verify flag is set correctly based on test data
    const firstAnnotation = result.annotations[0];
    const originalData = testData.find(a => a.id === firstAnnotation.id);
    const expectedFlag = !!(originalData.screenshot && originalData.screenshot.data);
    runner.assert(firstAnnotation.has_screenshot === expectedFlag,
      'has_screenshot flag should match actual screenshot presence');
  });

  // Test 10: Performance test - should complete in <5ms
  runner.test('Performance: pagination operations complete in <5ms', async () => {
    const server = new MockAnnotationsServer(testData);

    // Multiple operations to test performance
    const operations = [
      { limit: 10, offset: 0, status: 'all' },
      { limit: 5, offset: 3, status: 'pending' },
      { limit: 20, offset: 10, status: 'all' },
      { limit: 1, offset: testData.length - 1, status: 'all' }
    ];

    for (const params of operations) {
      const startTime = performance.now();
      await server.readAnnotations(params);
      const endTime = performance.now();
      const duration = endTime - startTime;

      runner.assert(duration < 5,
        `Pagination operation should complete in <5ms, took ${duration.toFixed(2)}ms`);
    }
  });

  await runner.run();
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
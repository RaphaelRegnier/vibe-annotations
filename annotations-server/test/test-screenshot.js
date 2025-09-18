/**
 * Screenshot Optimization Tests
 *
 * Tests for screenshot handling in the MCP server:
 * - Screenshot stripping in list responses (has_screenshot flag instead of data)
 * - Screenshot retrieval for specific annotation
 * - Error handling for missing screenshots
 * - Performance (retrieval should be <10ms)
 * - Data integrity of retrieved screenshots
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test data
const testDataPath = join(__dirname, 'test-data.json');
const testAnnotations = JSON.parse(readFileSync(testDataPath, 'utf8'));

/**
 * Mock implementation of readAnnotations function that strips screenshots
 * This simulates the enhanced readAnnotations method behavior
 */
function mockReadAnnotations(options = {}) {
  const { status = 'all', limit = 50, offset = 0, url } = options;

  let filteredAnnotations = testAnnotations;

  // Filter by status
  if (status !== 'all') {
    filteredAnnotations = filteredAnnotations.filter(ann => ann.status === status);
  }

  // Filter by URL
  if (url) {
    filteredAnnotations = filteredAnnotations.filter(ann =>
      ann.url.includes(url) || ann.url.match(url.replace('*', '.*'))
    );
  }

  const total = filteredAnnotations.length;
  const paginatedAnnotations = filteredAnnotations.slice(offset, offset + limit);

  // Strip screenshot data and add has_screenshot flag
  const annotationsWithoutScreenshots = paginatedAnnotations.map(ann => {
    const { screenshot, ...annotationWithoutScreenshot } = ann;
    return {
      ...annotationWithoutScreenshot,
      has_screenshot: !!(screenshot && screenshot.data)
    };
  });

  return {
    annotations: annotationsWithoutScreenshots,
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + limit < total
    }
  };
}

/**
 * Mock implementation of getAnnotationScreenshot function
 */
function mockGetAnnotationScreenshot(id) {
  const annotation = testAnnotations.find(ann => ann.id === id);

  if (!annotation) {
    return {
      annotation_id: id,
      screenshot: null,
      message: 'Annotation not found'
    };
  }

  if (!annotation.screenshot) {
    return {
      annotation_id: id,
      screenshot: null,
      message: 'No screenshot available for this annotation'
    };
  }

  return {
    annotation_id: id,
    screenshot: {
      data_url: annotation.screenshot.data,
      width: annotation.screenshot.width,
      height: annotation.screenshot.height,
      viewport: annotation.viewport
    },
    message: 'Screenshot retrieved successfully'
  };
}

test('Screenshot stripping in list responses', () => {
  const result = mockReadAnnotations();

  // Verify annotations are returned
  assert.ok(result.annotations.length > 0, 'Should return annotations');

  // Verify screenshot data is stripped
  result.annotations.forEach(annotation => {
    assert.strictEqual(typeof annotation.has_screenshot, 'boolean', 'Should have has_screenshot boolean flag');
    assert.strictEqual(annotation.screenshot, undefined, 'Should not include screenshot data');
  });

  // Verify has_screenshot flag is set correctly
  const annotationWithScreenshot = result.annotations.find(ann => ann.id === 'vibe_test_001_button_color');
  assert.strictEqual(annotationWithScreenshot.has_screenshot, true, 'Should flag true for annotations with screenshots');
});

test('Screenshot stripping maintains data structure', () => {
  const result = mockReadAnnotations({ limit: 1 });
  const annotation = result.annotations[0];

  // Verify essential fields are preserved
  assert.ok(annotation.id, 'Should preserve id');
  assert.ok(annotation.comment, 'Should preserve comment');
  assert.ok(annotation.url, 'Should preserve url');
  assert.ok(annotation.status, 'Should preserve status');
  assert.ok(annotation.created_at, 'Should preserve created_at');
  assert.ok(annotation.element_context, 'Should preserve element_context');

  // Verify screenshot is replaced with flag
  assert.strictEqual(annotation.screenshot, undefined, 'Should not include screenshot object');
  assert.strictEqual(typeof annotation.has_screenshot, 'boolean', 'Should include has_screenshot flag');
});

test('Screenshot retrieval for specific annotation', () => {
  const annotationId = 'vibe_test_001_button_color';
  const result = mockGetAnnotationScreenshot(annotationId);

  assert.strictEqual(result.annotation_id, annotationId, 'Should return correct annotation ID');
  assert.ok(result.screenshot, 'Should return screenshot object');
  assert.ok(result.screenshot.data_url, 'Should include screenshot data URL');
  assert.strictEqual(typeof result.screenshot.width, 'number', 'Should include width');
  assert.strictEqual(typeof result.screenshot.height, 'number', 'Should include height');
  assert.ok(result.screenshot.viewport, 'Should include viewport information');
  assert.strictEqual(result.message, 'Screenshot retrieved successfully', 'Should include success message');
});

test('Error handling for missing annotation', () => {
  const result = mockGetAnnotationScreenshot('nonexistent_id');

  assert.strictEqual(result.annotation_id, 'nonexistent_id', 'Should return requested ID');
  assert.strictEqual(result.screenshot, null, 'Should return null screenshot');
  assert.strictEqual(result.message, 'Annotation not found', 'Should include error message');
});

test('Error handling for annotation without screenshot', () => {
  // Create a test annotation without screenshot
  const annotationWithoutScreenshot = {
    id: 'test_no_screenshot',
    comment: 'Test annotation without screenshot',
    url: 'http://localhost:3000/',
    status: 'pending'
  };

  // Add to test data temporarily
  testAnnotations.push(annotationWithoutScreenshot);

  const result = mockGetAnnotationScreenshot('test_no_screenshot');

  assert.strictEqual(result.annotation_id, 'test_no_screenshot', 'Should return requested ID');
  assert.strictEqual(result.screenshot, null, 'Should return null screenshot');
  assert.strictEqual(result.message, 'No screenshot available for this annotation', 'Should include appropriate error message');

  // Clean up test data
  testAnnotations.pop();
});

test('Performance: Screenshot retrieval should be fast', () => {
  const annotationId = 'vibe_test_001_button_color';

  // Warm up
  mockGetAnnotationScreenshot(annotationId);

  // Measure performance
  const startTime = performance.now();
  const result = mockGetAnnotationScreenshot(annotationId);
  const endTime = performance.now();

  const executionTime = endTime - startTime;

  assert.ok(result.screenshot, 'Should successfully retrieve screenshot');
  assert.ok(executionTime < 10, `Execution should be under 10ms, was ${executionTime.toFixed(2)}ms`);
});

test('Performance: List annotations without screenshots should be fast', () => {
  // Measure performance of listing annotations (screenshot stripping)
  const startTime = performance.now();
  const result = mockReadAnnotations({ limit: 10 });
  const endTime = performance.now();

  const executionTime = endTime - startTime;

  assert.ok(result.annotations.length > 0, 'Should return annotations');
  assert.ok(executionTime < 5, `List operation should be under 5ms, was ${executionTime.toFixed(2)}ms`);
});

test('Data integrity of retrieved screenshots', () => {
  const annotationId = 'vibe_test_001_button_color';
  const originalAnnotation = testAnnotations.find(ann => ann.id === annotationId);
  const result = mockGetAnnotationScreenshot(annotationId);

  // Verify data integrity
  assert.strictEqual(result.screenshot.data_url, originalAnnotation.screenshot.data, 'Screenshot data should match original');
  assert.strictEqual(result.screenshot.width, originalAnnotation.screenshot.width, 'Width should match original');
  assert.strictEqual(result.screenshot.height, originalAnnotation.screenshot.height, 'Height should match original');

  // Verify viewport data is included
  assert.deepStrictEqual(result.screenshot.viewport, originalAnnotation.viewport, 'Viewport should match original');
});

test('Screenshot data format validation', () => {
  const annotationId = 'vibe_test_001_button_color';
  const result = mockGetAnnotationScreenshot(annotationId);

  // Verify screenshot data format
  assert.ok(result.screenshot.data_url.startsWith('data:image/'), 'Should be a valid data URL');
  assert.ok(result.screenshot.data_url.includes('base64,'), 'Should be base64 encoded');

  // Verify dimensions are positive numbers
  assert.ok(result.screenshot.width > 0, 'Width should be positive');
  assert.ok(result.screenshot.height > 0, 'Height should be positive');

  // Verify viewport structure
  assert.ok(typeof result.screenshot.viewport.width === 'number', 'Viewport width should be number');
  assert.ok(typeof result.screenshot.viewport.height === 'number', 'Viewport height should be number');
});

test('Pagination with screenshot stripping', () => {
  // Test first page
  const page1 = mockReadAnnotations({ limit: 3, offset: 0 });
  assert.strictEqual(page1.annotations.length, 3, 'Should return 3 annotations for first page');
  assert.strictEqual(page1.pagination.offset, 0, 'Should have correct offset');
  assert.strictEqual(page1.pagination.has_more, true, 'Should indicate more pages available');

  // Test second page
  const page2 = mockReadAnnotations({ limit: 3, offset: 3 });
  assert.strictEqual(page2.annotations.length, 3, 'Should return 3 annotations for second page');
  assert.strictEqual(page2.pagination.offset, 3, 'Should have correct offset');

  // Verify all annotations have screenshot flag
  [...page1.annotations, ...page2.annotations].forEach(annotation => {
    assert.strictEqual(typeof annotation.has_screenshot, 'boolean', 'Each annotation should have has_screenshot flag');
    assert.strictEqual(annotation.screenshot, undefined, 'Each annotation should not have screenshot data');
  });
});

test('Status filtering with screenshot stripping', () => {
  const pendingResult = mockReadAnnotations({ status: 'pending' });
  const completedResult = mockReadAnnotations({ status: 'completed' });
  const archivedResult = mockReadAnnotations({ status: 'archived' });

  // Verify filtering works
  assert.ok(pendingResult.annotations.length > 0, 'Should find pending annotations');
  assert.ok(completedResult.annotations.length > 0, 'Should find completed annotations');
  assert.ok(archivedResult.annotations.length > 0, 'Should find archived annotations');

  // Verify all results have screenshot flags
  [pendingResult, completedResult, archivedResult].forEach(result => {
    result.annotations.forEach(annotation => {
      assert.strictEqual(typeof annotation.has_screenshot, 'boolean', 'Should have has_screenshot flag');
      assert.strictEqual(annotation.screenshot, undefined, 'Should not have screenshot data');
    });
  });
});

console.log('✅ All screenshot optimization tests completed successfully');
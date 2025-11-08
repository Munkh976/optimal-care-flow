# End-to-End Testing with Playwright

This directory contains comprehensive E2E tests for the CareMuch application.

## Setup

Tests are automatically configured via `playwright.config.ts`. Dependencies are already installed.

## Running Tests

```bash
# Run all tests
npx playwright test

# Run tests in UI mode (interactive)
npx playwright test --ui

# Run specific test file
npx playwright test e2e/tests/auth.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Debug tests
npx playwright test --debug
```

## Test Structure

- **auth.setup.ts** - Authentication setup for tests that require login
- **auth.spec.ts** - Authentication flow tests (login, logout, registration)
- **users.spec.ts** - User management CRUD operations
- **caregivers.spec.ts** - Caregiver management and approvals
- **clients.spec.ts** - Client management operations
- **schedule.spec.ts** - Schedule and shift management
- **reports.spec.ts** - Reports and analytics functionality
- **agency-settings.spec.ts** - Agency settings and configuration
- **navigation.spec.ts** - Navigation and permission-based routing
- **role-permissions.spec.ts** - Role and permission management

## Test Coverage

The test suite covers:

✅ **Authentication**
- Login/logout flows
- Registration process
- Session persistence
- Access control

✅ **CRUD Operations**
- User management
- Caregiver management
- Client management
- Shift/schedule management

✅ **Navigation**
- Route protection
- Role-based menu visibility
- Breadcrumb navigation
- 404 handling

✅ **Data Flows**
- Form validation
- Data persistence
- Real-time updates
- Error handling

✅ **Permissions**
- Role-based access control
- Permission toggling
- Module-level restrictions

## Writing New Tests

1. Create a new `.spec.ts` file in `e2e/tests/`
2. Import test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Use authentication if needed:
   ```typescript
   test.use({ storageState: 'e2e/.auth/user.json' });
   ```
4. Write descriptive test cases with clear assertions

## Best Practices

- Use descriptive test names that explain what is being tested
- Wait for elements to be visible before interacting
- Use `page.waitForURL()` for navigation assertions
- Check for both success and error states
- Test with realistic data and timeouts
- Clean up test data when possible

## CI/CD Integration

Tests are configured to run in CI with:
- Automatic retries (2 retries in CI)
- HTML report generation
- Screenshots on failure
- Trace on first retry

## Viewing Test Reports

After running tests:
```bash
npx playwright show-report
```

This opens an interactive HTML report with:
- Test results and timings
- Screenshots of failures
- Execution traces
- Network requests

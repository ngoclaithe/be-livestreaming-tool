# Testing Guide

This document provides information on how to run and write tests for the Livestream Tool backend.

## Prerequisites

- Node.js 14.x or higher
- PostgreSQL 12.x or higher
- Redis 6.x or higher

## Running Tests

### 1. Set up the test database

Create a test database:

```bash
export NODE_ENV=test
npm run db:create
```

### 2. Run the tests

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run a specific test file:

```bash
npx jest test/path/to/test-file.test.js
```

Run tests with coverage:

```bash
npm test -- --coverage
```

## Writing Tests

### Test Structure

Tests are organized in the `test` directory with the following structure:

```
test/
  models/           # Model tests
  controllers/      # Controller tests
  middleware/       # Middleware tests
  integration/      # Integration tests
  setup.js          # Test setup
```

### Test Naming Conventions

- Test files should be named with the pattern `*.test.js` or `*.spec.js`
- Use descriptive test names that explain what is being tested
- Group related tests with `describe` blocks
- Use `it` or `test` for individual test cases

### Best Practices

1. **Isolation**: Each test should be independent and not rely on the state from other tests.
2. **Mocks**: Use mocks for external services and dependencies.
3. **Cleanup**: Clean up any test data after tests complete.
4. **Assertions**: Make specific assertions about the expected behavior.
5. **Readability**: Write clear and descriptive test names and assertions.

### Example Test

```javascript
describe('User Model', () => {
  beforeAll(async () => {
    // Setup code that runs once before all tests
    await sequelize.sync({ force: true });
  });

  afterEach(async () => {
    // Cleanup after each test
    await User.destroy({ where: {}, truncate: true });
  });

  it('should create a new user', async () => {
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    
    expect(user).toHaveProperty('id');
    expect(user.name).toBe('Test User');
  });
});
```

## Debugging Tests

To debug tests in VS Code, add this configuration to your `launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Current File",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "${fileBasename}",
        "--config",
        "jest.config.js"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## Continuous Integration

Tests are automatically run on pull requests and pushes to the main branch using GitHub Actions. The CI pipeline includes:

1. Linting with ESLint
2. Running tests with Jest
3. Generating test coverage reports

## Test Coverage

To generate a coverage report:

```bash
npm test -- --coverage
```

This will create a `coverage` directory with detailed coverage reports. Open `coverage/lcov-report/index.html` in a browser to view the report.

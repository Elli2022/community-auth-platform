# NodeJS-3rd-Challenge

## Overview
This repository contains a Node.js project that demonstrates the implementation of a microservice architecture using Express. The project includes essential functionalities such as GET and POST endpoints, file system operations, and logging for monitoring the microservices. The service communicates with a database and manages HTTP requests efficiently.

### Features
- **GET Endpoint:**
  - Retrieves data based on request parameters.
  - Logs request details and errors.
  - Returns JSON response with the requested data or error information.

- **POST Endpoint:**
  - Accepts data through the request body.
  - Processes and stores the data.
  - Logs request details and errors.
  - Returns JSON response with the results or error information.

- **File System Operations:**
  - Checks and creates directories if they don't exist.
  - Reads from files and parses JSON content.
  - Writes data to files in JSON format.
  - Logs each step of the file operations for traceability.

### File Structure
- **src/app/component/controller/index.ts**:
  - Contains the main routing logic.
  - Defines the GET and POST endpoints.
  - Implements error handling and logging.

- **src/app/component/data-access/**:
  - **check-dir.ts**: Checks for directory existence and creates it if necessary.
  - **read-from-file.ts**: Reads and parses JSON data from a file.
  - **write-to-file.ts**: Writes data to a file in JSON format.
  - **index.ts**: Centralizes data access functions for checking directories, reading from, and writing to files.

- **src/app/component/entities/**:
  - **data-manipulation.ts**: Contains data manipulation functions, such as date transformation.
  - **index.ts**: Aggregates entity functions, including input object creation and sanitization.
  - **make-input-object.ts**: Validates and sanitizes user input data, and applies necessary transformations.

- **src/app/component/use-cases/**:
  - **get.ts**: Implements the logic for handling GET requests.
  - **post.ts**: Implements the logic for handling POST requests.
  - **index.ts**: Centralizes use-case functions for GET and POST requests.
  - **userHandler.ts**: Manages user data by reading from and writing to a JSON file.

- **src/app/initializers/express/**:
  - **libs/express.ts**: Sets up and configures the Express server with middleware and routing.
  - **index.ts**: Initializes and starts the Express server, incorporating routes and middleware.

- **src/app/libs/logger/**:
  - **index.ts**: Configures and initializes the logger using Winston.
  - **libs/transports.ts**: Sets up different transports for logging in development and production environments.

### Development Setup

Requires **Node.js 22+**.

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run the Application**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build && npm start
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Web UI** (lokalt med `npm run dev`):
   - Öppna `http://127.0.0.1:3000/` i webbläsaren
   - Registrera användare, se lista, validering och API-status

6. **Access the API**:
   - Health: `http://127.0.0.1:3000/health`
   - Base URL: `http://127.0.0.1:3000/api/v1/`
   - Use appropriate HTTP methods (GET, POST) to interact with the endpoints.

**Live:** [nodejs-3rd-challenge-api.netlify.app](https://nodejs-3rd-challenge-api.netlify.app)

### Database (PostgreSQL)

User data is stored in **PostgreSQL** (persistent, works on Netlify).

**Lokalt med Docker:**

```bash
cp .env.example .env
npm run db:up          # startar Postgres på port 5432
npm run db:migrate     # skapar tabellen users
npm run dev
```

**Produktion (Netlify):** skapa en gratis databas på [Neon](https://neon.tech), kopiera connection string och lägg in som `DATABASE_URL` under Netlify → Site settings → Environment variables.

### Security

- **sanitize-html** is pinned to `^2.17.4` (fixes CVE-2026-44990).
- User input is sanitized with `allowedTags: []` before validation.
- Passwords are hashed with **bcrypt** (replacing MD5).

### Detailed Implementation
- **Controller (index.ts)**:
  - Defines asynchronous functions `getEP` and `postEP` to handle GET and POST requests, respectively.
  - Uses a centralized logger for tracking activities and errors.

- **Data Access (data-access/index.ts)**:
  - Aggregates data access functions: `checkDir`, `writeToFile`, and `readFromFile`.
  - Each function logs its activities for easier debugging and monitoring.

- **Directory Check (check-dir.ts)**:
  - Implements `checkDir` function to verify the existence of a directory and create it if it does not exist.
  - Logs actions such as checking and creating directories.

- **Read from File (read-from-file.ts)**:
  - Implements `readFromFile` function to read and parse JSON content from a file.
  - Handles and logs errors, returning an empty array if the file does not exist.

- **Write to File (write-to-file.ts)**:
  - Implements `writeToFile` function to write data to a file in JSON format.
  - Logs the start and completion of write operations.

- **Data Manipulation (data-manipulation.ts)**:
  - Implements `transformDate` function to convert timestamps to local date and time string format.

- **Entity Functions (index.ts and make-input-object.ts)**:
  - Aggregates entity functions for input validation and sanitization.
  - `makeInputObj` function creates a sanitized input object with validated parameters.

- **Use Cases (use-cases/index.ts, get.ts, post.ts)**:
  - Implements business logic for handling GET and POST requests.
  - `createGet` and `createPost` functions handle the respective requests and integrate with data access functions.
  - `userHandler.ts` manages user data storage and retrieval.

- **Express Initializer (initializers/express/index.ts, libs/express.ts)**:
  - Sets up the Express server with necessary middleware: body-parser, compression, cors, helmet.
  - Defines and initializes server settings and routes.
  - Uses a logger to log server activities.

- **Logging (libs/logger/index.ts, libs/transports.ts)**:
  - Configures Winston logger with custom formats and transports.
  - Differentiates logging setups for development and production environments.

### Environment Configuration
- **Environment Variables**:
  - `NAME`: Name of the application.
  - `NODE_HOSTNAME`: Hostname for the server.
  - `NODE_PORT`: Port number for the server.

### Testing
- **Configuration (config/index.ts)**:
  - Stores configuration data such as file paths, error messages, and test data.

- **Test Cases**:
  - **get.spec.ts**: Tests for the GET use case.
  - **post.spec.ts**: Tests for the POST use case.

### Logging
- Utilizes a logger to track important events and errors.
- Logs include service-specific messages and timestamps for better traceability.
- Example log messages:
  - `[EXPRESS] Server running at http://127.0.0.1:3000`
  - `[EP][GET] GET: {error message}`
  - `[EP][POST] POST: {error message}`
  - `[DATA-ACCESS][CHECK-DIR] Checking {directory name}`
  - `[DATA-ACCESS][READ-FROM-FILE] Reading from {filename} - START!`
  - `[DATA-ACCESS][WRITE-TO-FILE] Writing to {filename} - START!`

### Future Enhancements
- Implement additional endpoints for more CRUD operations.
- Integrate with a database for persistent data storage.
- Enhance error handling and validation mechanisms.

### Contribution
Feel free to fork the repository and submit pull requests. For major changes, please open an issue first to discuss what you would like to change.

### License
This project is licensed under the MIT License.

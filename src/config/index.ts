const ERROR_MSG = {
  post: {
    NO_DATA: "no data to insert",
    EXISTING_USER: "user already exists",
    EXISTING_EMAIL: "email already registered",
    WALL_USER_NOT_FOUND: "username must be registered before posting",
    WALL_MESSAGE_REQUIRED: "message is required",
    INVALID_EMAIL: "Ogiltig e-postadress.",
    INVALID_STRING: "Invalid string for ",
    INVALID_USERNAME_EMAIL:
      "Användarnamn kan inte vara en e-postadress. Fyll i e-post i fältet ”E-post” i stället.",
    INVALID_USERNAME_LENGTH:
      "Användarnamn måste vara 5–24 tecken.",
    INVALID_USERNAME_CHARS:
      "Användarnamn får bara innehålla bokstäver (A–Z/a–z) och siffror, och måste börja med en bokstav.",
    INVALID_USERNAME: "Ogiltigt användarnamn.",
    MISSING_PARAMETER: "Saknad uppgift: ",
    INVALID_CREDENTIALS: "Invalid credentials",
  },
};

const TEST_DATA = {
  user1: { username: "user1", password: "password" },
  user2: { username: "user2", password: "password" },
  user3: { username: "user3", password: "password" },
};

export default Object.freeze({
  APP_NAME: process.env.NODE_NAME ?? "flodet",
  ERROR_MSG,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  NODE_HOSTNAME: process.env.NODE_HOSTNAME ?? "127.0.0.1",
  NODE_PORT: Number(process.env.NODE_PORT ?? 3000),
  TEST_DATA,
});

type SanitizeFn = (text: string) => string;
type HashFn = (text: string) => string;

interface InputFactoryDeps {
  hashPassword: HashFn;
  sanitize: SanitizeFn;
}

export default function makeInputObjectFactory({
  hashPassword,
  sanitize,
}: InputFactoryDeps) {
  function inputObj({
    params,
    errorMsgs,
  }: {
    params: Record<string, unknown>;
    errorMsgs: Record<string, string>;
  }) {
    const {
      username,
      password,
      email,
      name,
      surname,
      created = Date.now(),
      modified = Date.now(),
    } = params;

    return Object.freeze({
      username: () => checkUsername({ username, errorMsgs }),
      password: () => checkPassword({ password, errorMsgs }),
      email: () => checkEmail({ email, errorMsgs }),
      name: () => checkName({ name, errorMsgs }),
      surname: () => checkName({ name: surname, errorMsgs }),
      created: () => created,
      modified: () => modified,
    });
  }

  function checkUsername({
    username,
    errorMsgs,
  }: {
    username: unknown;
    errorMsgs: Record<string, string>;
  }) {
    checkRequiredParam({ param: username, paramName: "username", errorMsgs });

    if (typeof username !== "string") {
      throw new Error(errorMsgs.INVALID_USERNAME ?? errorMsgs.INVALID_STRING + "username");
    }

    const value = username.trim();
    if (value.includes("@") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error(errorMsgs.INVALID_USERNAME_EMAIL);
    }
    if (value.length <= 4 || value.length >= 25) {
      throw new Error(errorMsgs.INVALID_USERNAME_LENGTH);
    }
    if (!/^[a-z][a-z0-9]+$/.test(value)) {
      throw new Error(errorMsgs.INVALID_USERNAME_CHARS);
    }

    return sanitize(value);
  }

  function checkPassword({
    password,
    errorMsgs,
  }: {
    password: unknown;
    errorMsgs: Record<string, string>;
  }) {
    checkRequiredParam({ param: password, paramName: "password", errorMsgs });
    const sanitized = sanitize(String(password));
    return hashPassword(sanitized);
  }

  function checkEmail({
    email,
    errorMsgs,
  }: {
    email: unknown;
    errorMsgs: Record<string, string>;
  }) {
    checkRequiredParam({ param: email, paramName: "email", errorMsgs });

    if (typeof email !== "string" || !emailValidator(email)) {
      throw new Error(errorMsgs.INVALID_EMAIL);
    }

    return sanitize(email);
  }

  function emailValidator(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function checkName({
    name,
    errorMsgs,
  }: {
    name: unknown;
    errorMsgs: Record<string, string>;
  }) {
    checkRequiredParam({ param: name, paramName: "name", errorMsgs });

    if (typeof name !== "string" || name.trim() === "") {
      throw new Error(`${errorMsgs.INVALID_STRING}name`);
    }

    return sanitize(name);
  }

  function checkRequiredParam({
    param,
    paramName,
    errorMsgs,
  }: {
    param: unknown;
    paramName: string;
    errorMsgs: Record<string, string>;
  }) {
    if (param === undefined || param === null || param === "") {
      throw new Error(`${errorMsgs.MISSING_PARAMETER}${paramName}`);
    }
  }

  return Object.freeze({ inputObj });
}

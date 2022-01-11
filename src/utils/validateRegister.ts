import { UsernamePasswordInput } from "src/resolvers/UsernamePasswordInput";

export const validateRegister = (input: UsernamePasswordInput) => {
  const { password, username, email } = input;

  if (!email.includes("@")) {
    return [
      {
        field: "email",
        message: "Invalid email!",
      },
    ];
  }

  if (username.length <= 2) {
    return [
      {
        field: "username",
        message: "Username length must be greater than 2",
      },
    ];
  }

  if (username.includes("@")) {
    return [
      {
        field: "username",
        message: "Can not include @",
      },
    ];
  }

  if (password.length <= 3) {
    return [
      {
        field: "password",
        message: "Password length must be greater than 3",
      },
    ];
  }

  return null;
};

import bcrypt from "bcrypt";
import { sendEmail, siteBaseUrl } from "../../libs/email";
import type makeRecoveryRepository from "../../db/recovery-repository";
import type makeUsersRepository from "../../db/users-repository";

type RecoveryRepository = ReturnType<typeof makeRecoveryRepository>;
type UsersRepository = ReturnType<typeof makeUsersRepository>;

const GENERIC_EMAIL_MSG =
  "Om e-postadressen är kopplad till ett konto skickar vi instruktioner inom några minuter.";

/** Opt-in only (local .env). Netlify esbuild can inline NODE_ENV at bundle time. */
function allowDevRecoveryFallback(): boolean {
  return process.env.ALLOW_DEV_RECOVERY_FALLBACK === "true";
}

export function createAuthRecovery({
  usersRepository,
  recoveryRepository,
}: {
  usersRepository: UsersRepository;
  recoveryRepository: RecoveryRepository;
}) {
  return Object.freeze({
    forgotPassword: async (params: Record<string, unknown>) => {
      const email =
        typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Ange en giltig e-postadress.");
      }

      const user = await usersRepository.findByEmail(email);
      const result: {
        message: string;
        dev_reset_url?: string;
      } = { message: GENERIC_EMAIL_MSG };

      if (!user?.email) {
        return result;
      }

      const token = await recoveryRepository.createResetToken(user.username);
      const resetUrl = `${siteBaseUrl()}/#/reset-password?token=${token}`;

      const { sent } = await sendEmail({
        to: user.email,
        subject: "Återställ lösenord – Community Hub",
        html: `
          <p>Hej ${user.name || user.username},</p>
          <p>Du bad om att återställa lösenordet. Klicka länken (giltig i 1 timme):</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Om du inte begärt detta kan du ignorera mailet.</p>
        `,
      });

      if (!sent && allowDevRecoveryFallback()) {
        result.dev_reset_url = resetUrl;
        result.message +=
          " E-postutskick är inte aktiverat — använd återställningslänken nedan.";
      }

      return result;
    },

    forgotUsername: async (params: Record<string, unknown>) => {
      const email =
        typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Ange en giltig e-postadress.");
      }

      const user = await usersRepository.findByEmail(email);
      const result: {
        message: string;
        dev_username?: string;
      } = {
        message:
          "Om e-postadressen är registrerad skickar vi ditt användarnamn till den adressen.",
      };

      if (!user?.email) {
        return result;
      }

      const { sent } = await sendEmail({
        to: user.email,
        subject: "Ditt användarnamn – Community Hub",
        html: `
          <p>Hej!</p>
          <p>Du bad om en påminnelse om användarnamnet på Community Hub.</p>
          <p><strong>Användarnamn:</strong> @${user.username}</p>
          <p><a href="${siteBaseUrl()}/#/login">Logga in här</a></p>
        `,
      });

      if (!sent && allowDevRecoveryFallback()) {
        result.dev_username = user.username;
        result.message +=
          " E-postutskick är inte aktiverat — ditt användarnamn visas nedan.";
      }

      return result;
    },

    resetPassword: async (params: Record<string, unknown>) => {
      const token =
        typeof params.token === "string" ? params.token.trim() : "";
      const password =
        typeof params.password === "string" ? params.password : "";

      if (!token) throw new Error("Återställningslänken är ogiltig.");
      if (!password || password.length < 6) {
        throw new Error("Lösenordet måste vara minst 6 tecken.");
      }

      const row = await recoveryRepository.findValidToken(token);
      if (!row) {
        throw new Error("Länken har gått ut eller använts redan. Begär en ny återställning.");
      }

      const hash = bcrypt.hashSync(password, 10);
      await usersRepository.updatePassword(row.username, hash);
      await recoveryRepository.markTokenUsed(token);

      return {
        message: "Lösenordet är uppdaterat. Du kan logga in nu.",
        username: row.username,
      };
    },
  });
}

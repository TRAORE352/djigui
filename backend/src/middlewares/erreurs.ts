import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/erreurs.js";

/**
 * Transforme toute erreur au format du contrat : { erreur: { code, message, champ? } }.
 * Une AppError est déjà maîtrisée ; le reste est journalisé sans rien fuir.
 */
export const gestionErreurs: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      erreur: {
        code: err.code,
        message: err.message,
        ...(err.champ ? { champ: err.champ } : {}),
      },
    });
    return;
  }
  /*
   * Base de données injoignable : ce n'est pas un bug applicatif, et le
   * message générique « Erreur interne » pousse l'agent à réessayer la
   * même action en boucle. On répond 503 avec une cause lisible, pour
   * que l'écran puisse dire quoi faire (patienter, puis réessayer).
   */
  if (estPanneBase(err)) {
    console.error("[db] indisponible :", (err as Error).message);
    res.status(503).json({
      erreur: {
        code: "SERVICE_INDISPONIBLE",
        message: "La base de données ne répond pas. Réessayez dans un instant.",
      },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ erreur: { code: "ERREUR_SERVEUR", message: "Erreur interne" } });
};

/**
 * Reconnaît une panne d'infrastructure PostgreSQL (délai de connexion
 * dépassé, connexion coupée, hôte injoignable) par opposition à une
 * erreur SQL applicative, qui reste un 500 à corriger dans le code.
 */
function estPanneBase(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code;
  if (code && ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET", "EPIPE", "57P01", "08006", "08003"].includes(code)) {
    return true;
  }
  return /timeout exceeded when trying to connect|Connection terminated|Client has encountered a connection error/i
    .test(err.message);
}

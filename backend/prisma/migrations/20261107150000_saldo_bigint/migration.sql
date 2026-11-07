-- Saldo da carteira em BIGINT (revisão de segurança de 07/11).
-- O licitante tem teto de R$ 10 mi, mas o leiloeiro recebe arremates sem teto. Em INTEGER
-- (até R$ 21,47 mi), o crédito que passasse desse valor faria a liquidação falhar para sempre,
-- e o valor do vencedor ficaria preso como comprometido. Os CHECKs de saldo continuam valendo.
ALTER TABLE "Wallet" ALTER COLUMN "totalCents" SET DATA TYPE BIGINT,
ALTER COLUMN "committedCents" SET DATA TYPE BIGINT;

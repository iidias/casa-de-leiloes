-- CHECKs de dinheiro e saldo (tarefa 24). O Prisma não gera CHECK pelo schema.
-- São a última linha de defesa: se um bug tentar deixar saldo inválido, o banco recusa.

-- Comprometido nunca negativo nem maior que o total (D4).
ALTER TABLE "Wallet" ADD CONSTRAINT wallet_committed_nonneg CHECK ("committedCents" >= 0);
ALTER TABLE "Wallet" ADD CONSTRAINT wallet_committed_le_total CHECK ("committedCents" <= "totalCents");

-- Lance inicial e incremento sempre positivos; início antes do fim.
ALTER TABLE "Lot" ADD CONSTRAINT lot_prices_positive CHECK ("startingPriceCents" > 0 AND "minIncrementCents" > 0);
ALTER TABLE "Lot" ADD CONSTRAINT lot_dates_order CHECK ("startsAt" < "endsAt");

-- Nenhum lance com valor zero ou negativo.
ALTER TABLE "Bid" ADD CONSTRAINT bid_amount_positive CHECK ("amountCents" > 0);

import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Setup files podem rodar mais de uma vez; applyD1Migrations só aplica o que
// ainda não foi aplicado, então é seguro chamar aqui sem checagem extra.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

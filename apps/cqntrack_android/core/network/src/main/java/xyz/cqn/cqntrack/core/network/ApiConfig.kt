package xyz.cqn.cqntrack.core.network

/**
 * Mesmo backend do web/Capacitor (apps/cqntrack_be) — não é um domínio novo.
 * Sem variação por build type por enquanto (o backend só tem produção, ver
 * CLAUDE.md "só produção por enquanto"); quando existir um ambiente de dev
 * do backend, isso vira BuildConfig por variant em vez de constante fixa.
 */
object ApiConfig {
    const val BASE_URL = "https://api.track.cqn.xyz.br"
}

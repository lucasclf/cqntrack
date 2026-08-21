package xyz.cqn.cqntrack.core.network

/** Espelha ApiError de apps/cqntrack_fe/src/lib/api-client.ts. */
class ApiException(
    val status: Int,
    message: String,
) : Exception(message)

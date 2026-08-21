package xyz.cqn.cqntrack.books.data

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/** Espelha apps/cqntrack_be/src/books/lists.routes.ts, montado em /api/books-lists. */
interface BookListsApi {
    @GET("api/books-lists")
    suspend fun getLists(): BookListsResponseDto

    @POST("api/books-lists")
    suspend fun createList(@Body body: CreateBookListRequestDto): BookListDto

    @GET("api/books-lists/{listId}")
    suspend fun getListDetail(@Path("listId") listId: String): BookListDetailDto

    @PATCH("api/books-lists/{listId}")
    suspend fun updateList(
        @Path("listId") listId: String,
        @Body body: UpdateBookListRequestDto,
    ): BookListDto

    @DELETE("api/books-lists/{listId}")
    suspend fun deleteList(@Path("listId") listId: String)

    @PUT("api/books-lists/{listId}/items/{googleBooksId}")
    suspend fun addItem(@Path("listId") listId: String, @Path("googleBooksId") googleBooksId: String)

    @DELETE("api/books-lists/{listId}/items/{googleBooksId}")
    suspend fun removeItem(@Path("listId") listId: String, @Path("googleBooksId") googleBooksId: String)
}

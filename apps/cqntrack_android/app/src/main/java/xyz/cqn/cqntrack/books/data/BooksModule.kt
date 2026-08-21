package xyz.cqn.cqntrack.books.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object BooksModule {
    @Provides
    @Singleton
    fun provideBooksApi(retrofit: Retrofit): BooksApi = retrofit.create(BooksApi::class.java)

    @Provides
    @Singleton
    fun provideBookListsApi(retrofit: Retrofit): BookListsApi = retrofit.create(BookListsApi::class.java)
}

package xyz.cqn.cqntrack.series.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SeriesModule {
    @Provides
    @Singleton
    fun provideSeriesApi(retrofit: Retrofit): SeriesApi = retrofit.create(SeriesApi::class.java)
}

package xyz.cqn.cqntrack.people.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object PeopleModule {
    @Provides
    @Singleton
    fun providePeopleApi(retrofit: Retrofit): PeopleApi = retrofit.create(PeopleApi::class.java)
}

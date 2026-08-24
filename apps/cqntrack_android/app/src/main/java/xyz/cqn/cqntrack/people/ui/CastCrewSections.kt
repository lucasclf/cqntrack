package xyz.cqn.cqntrack.people.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import xyz.cqn.cqntrack.people.data.CastMemberDto
import xyz.cqn.cqntrack.people.data.CrewMemberDto

/**
 * Elenco de filme/série — carrossel horizontal, cada cartão linkando pra
 * PersonDetailScreen. Reutilizado por MovieDetailScreen e SeriesDetailScreen
 * (mesmo formato nos dois, espelha CastList.tsx no web). Não renderiza nada
 * quando a lista está vazia.
 */
@Composable
fun CastSection(title: String, cast: List<CastMemberDto>, onPersonClick: (Int) -> Unit) {
    if (cast.isEmpty()) return

    Column(modifier = Modifier.padding(top = 16.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 16.dp))
        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            cast.forEach { member ->
                Column(
                    modifier = Modifier
                        .width(88.dp)
                        .padding(end = 12.dp)
                        .clickable { onPersonClick(member.personId) },
                ) {
                    AsyncImage(model = member.profileUrl, contentDescription = null, modifier = Modifier.size(88.dp))
                    Text(
                        member.name,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(
                        member.character,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

/**
 * "Direção" de filme, "Criado por"/"Direção" de série — mesmo formato de
 * pessoa+foto nos três casos, espelha CrewList.tsx no web. `episodeCount`
 * (só preenchido em "Direção" de série) aparece como "(N episódios)" quando
 * presente. Não renderiza nada quando a lista está vazia.
 */
@Composable
fun CrewSection(title: String, crew: List<CrewMemberDto>, onPersonClick: (Int) -> Unit) {
    if (crew.isEmpty()) return

    Column(modifier = Modifier.padding(top = 16.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 16.dp))
        crew.forEach { member ->
            Text(
                text = member.episodeCount?.let { "${member.name} ($it episódios)" } ?: member.name,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .padding(horizontal = 16.dp, vertical = 4.dp)
                    .clickable { onPersonClick(member.personId) },
            )
        }
    }
}

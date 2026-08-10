-- Copia o histórico de game_activity para a nova tabela genérica `activity`,
-- montando o snapshot (item_title/item_href/item_cover_url) a partir do
-- estado atual de `game` — produção já tem atividade real de usuários, essa
-- migração NÃO pode ser um drop-and-recreate.
--
-- item_cover_url replica buildCoverUrl() (src/integrations/igdb/types.ts),
-- tamanho "cover_big": https://images.igdb.com/igdb/image/upload/t_cover_big/<image_id>.jpg
INSERT INTO `activity` (`id`, `user_id`, `media_type`, `item_id`, `item_title`, `item_href`, `item_cover_url`, `type`, `metadata`, `created_at`)
SELECT
  ga.`id`,
  ga.`user_id`,
  'games',
  CAST(ga.`game_id` AS TEXT),
  g.`name`,
  '/jogos/' || ga.`game_id`,
  CASE WHEN g.`cover_image_id` IS NOT NULL
    THEN 'https://images.igdb.com/igdb/image/upload/t_cover_big/' || g.`cover_image_id` || '.jpg'
    ELSE NULL
  END,
  ga.`type`,
  ga.`metadata`,
  ga.`created_at`
FROM `game_activity` ga
JOIN `game` g ON g.`igdb_id` = ga.`game_id`;

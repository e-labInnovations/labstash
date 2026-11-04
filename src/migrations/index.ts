import * as migration_20261102_161054_initial from './20261102_161054_initial'
import * as migration_20261102_164757_location_columns from './20261102_164757_location_columns'
import * as migration_20261103_052015_part_images from './20261103_052015_part_images'
import * as migration_20261104_053348_labs from './20261104_053348_labs'
import * as migration_20261104_064909_shared_parts from './20261104_064909_shared_parts'
import * as migration_20261104_072744_attachments_themes from './20261104_072744_attachments_themes'
import * as migration_20261104_125306_user_name from './20261104_125306_user_name'

export const migrations = [
  {
    up: migration_20261102_161054_initial.up,
    down: migration_20261102_161054_initial.down,
    name: '20261102_161054_initial',
  },
  {
    up: migration_20261102_164757_location_columns.up,
    down: migration_20261102_164757_location_columns.down,
    name: '20261102_164757_location_columns',
  },
  {
    up: migration_20261103_052015_part_images.up,
    down: migration_20261103_052015_part_images.down,
    name: '20261103_052015_part_images',
  },
  {
    up: migration_20261104_053348_labs.up,
    down: migration_20261104_053348_labs.down,
    name: '20261104_053348_labs',
  },
  {
    up: migration_20261104_064909_shared_parts.up,
    down: migration_20261104_064909_shared_parts.down,
    name: '20261104_064909_shared_parts',
  },
  {
    up: migration_20261104_072744_attachments_themes.up,
    down: migration_20261104_072744_attachments_themes.down,
    name: '20261104_072744_attachments_themes',
  },
  {
    up: migration_20261104_125306_user_name.up,
    down: migration_20261104_125306_user_name.down,
    name: '20261104_125306_user_name',
  },
]

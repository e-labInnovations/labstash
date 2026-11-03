import * as migration_20261102_161054_initial from './20261102_161054_initial'
import * as migration_20261102_164757_location_columns from './20261102_164757_location_columns'
import * as migration_20261103_052015_part_images from './20261103_052015_part_images'

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
]

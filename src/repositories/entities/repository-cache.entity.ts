import {
  Entity,
  ObjectIdColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ObjectId,
} from 'typeorm'

export type GitProvider = 'github' | 'gitlab'

/**
 * LuminaJson block structure
 */
export interface LuminaJsonBlock {
  id: string
  title: {
    he_text: string
    en_text: string
  }
  prerequisites: string[]
  parents: string[]
  [key: string]: unknown
}

/**
 * LuminaJson structure
 */
export interface LuminaJson {
  blocks: LuminaJsonBlock[]
  [key: string]: unknown
}

@Entity('repository_caches')
@Index(['provider', 'organization', 'repository', 'commitSha'], {
  unique: true,
})
@Index(['provider', 'organization', 'repository'])
export class RepositoryCache {
  @ObjectIdColumn()
  id!: ObjectId

  @Column()
  provider!: GitProvider

  @Column()
  organization!: string

  @Column()
  repository!: string

  @Column()
  commitSha!: string

  @Column('simple-json')
  content!: LuminaJson

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}

import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
@Entity()
export class User extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field() //! Through this we can expose this field to graphql schema.
  @Column({unique: true}) //! Through this we can make it a table property.
  username!: string;

  @Field()
  @Column()
  email!: string;

  //! Just as a database table
  @Column()
  password!: string;
}

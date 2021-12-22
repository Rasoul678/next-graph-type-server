import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
@Entity()
export class User {
  @Field()
  @PrimaryKey()
  id!: number;

  @Field(() => String)
  @Property({ type: "date" })
  createdAt: Date = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Field() //! Through this we can expose this field to graphql schema.
  @Property({ type: "text", unique: true }) //! Through this we can make it a table property.
  username!: string;

  @Property({ type: "text" })
  password!: string;
}

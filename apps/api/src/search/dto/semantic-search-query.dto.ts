import { Transform, Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { EMBEDDING_ENTITY_TYPES, EmbeddingEntityType } from "../embeddings.service";

export class SemanticSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  q!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string"
      ? value.split(",").map((item: string) => item.trim().toUpperCase())
      : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(EMBEDDING_ENTITY_TYPES, { each: true })
  entityTypes?: EmbeddingEntityType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class IndexMetaQueryDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;
}

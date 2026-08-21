import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../auth/types";
import { ContentPlansService } from "./content-plans.service";
import { PlanGenerationService } from "./plan-generation.service";
import { CreateContentPlanDto } from "./dto/create-content-plan.dto";
import { UpdateContentPlanDto } from "./dto/update-content-plan.dto";
import { CreateContentPlanItemDto } from "./dto/create-content-plan-item.dto";
import { UpdateContentPlanItemDto } from "./dto/update-content-plan-item.dto";
import { GenerateContentPlanDto } from "./dto/generate-content-plan.dto";

class ListPlansQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;
}

@Controller("content-plans")
export class ContentPlansController {
  constructor(
    private readonly contentPlansService: ContentPlansService,
    private readonly planGenerationService: PlanGenerationService,
  ) {}

  @Post()
  create(@Body() dto: CreateContentPlanDto) {
    return this.contentPlansService.create(dto);
  }

  @Post("generate")
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateContentPlanDto) {
    return this.planGenerationService.generate(user.userId, dto);
  }

  @Get()
  list(@Query() query: ListPlansQueryDto) {
    return this.contentPlansService.list(
      query.page,
      query.pageSize,
      query.projectId,
    );
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.contentPlansService.getById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateContentPlanDto) {
    return this.contentPlansService.update(id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.contentPlansService.remove(id, user.userId);
  }

  @Post(":id/items")
  createItem(@Param("id") id: string, @Body() dto: CreateContentPlanItemDto) {
    return this.contentPlansService.createItem(id, dto);
  }

  @Patch("items/:itemId")
  updateItem(
    @Param("itemId") itemId: string,
    @Body() dto: UpdateContentPlanItemDto,
  ) {
    return this.contentPlansService.updateItem(itemId, dto);
  }

  @Delete("items/:itemId")
  removeItem(@Param("itemId") itemId: string) {
    return this.contentPlansService.removeItem(itemId);
  }
}

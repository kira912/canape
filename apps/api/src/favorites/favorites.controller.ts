import { Controller, Delete, Get, HttpCode, Param, Put, UseGuards } from "@nestjs/common";
import { favoriteRefSchema, type AppLanguage, type FavoriteRef } from "@canape/shared";
import { Language } from "../common/language.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentMember, type AuthenticatedMember } from "../household/current-member";
import { MemberGuard } from "../household/member.guard";
import { FavoritesService } from "./favorites.service";

@Controller("favorites")
@UseGuards(MemberGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentMember() member: AuthenticatedMember, @Language() language: AppLanguage) {
    return this.favorites.list(member, language);
  }

  @Put(":list/:mediaType/:tmdbId")
  @HttpCode(204)
  add(@CurrentMember() member: AuthenticatedMember, @Param(new ZodValidationPipe(favoriteRefSchema)) ref: FavoriteRef) {
    return this.favorites.add(member, ref);
  }

  @Delete(":list/:mediaType/:tmdbId")
  @HttpCode(204)
  remove(@CurrentMember() member: AuthenticatedMember, @Param(new ZodValidationPipe(favoriteRefSchema)) ref: FavoriteRef) {
    return this.favorites.remove(member, ref);
  }
}

from pydantic import BaseModel, ConfigDict


class RecipeIngredientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    quantity: float
    unit: str
    is_optional: bool


class RecipeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    slug: str
    description: str
    prep_minutes: int
    servings: int


class RecipeOut(RecipeSummary):
    instructions: str
    ingredients: list[RecipeIngredientOut] = []

"""Seed data — default food categories and recipes inserted on first startup."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.logging import log
from app.models.food import Category
from app.models.recipe import Recipe, RecipeIngredient

# name → icon. Names match the categories the AI receipt parser returns,
# so scanned items can be auto-linked by category name.
DEFAULT_CATEGORIES: list[tuple[str, str]] = [
    ("Dairy", "🥛"),
    ("Vegetables", "🥬"),
    ("Fruit", "🍎"),
    ("Meat", "🍗"),
    ("Fish", "🐟"),
    ("Bakery", "🍞"),
    ("Drinks", "🧃"),
    ("Frozen", "🧊"),
    ("Grains", "🌾"),
    ("Snacks", "🍫"),
    ("Other", "🍽️"),
]


# slug, name, aliases, description, prep, servings, instructions,
# [ (ingredient, qty, unit, is_optional) ]
DEFAULT_RECIPES: list[dict] = [
    {
        "slug": "zeberka-bbq", "name": "Żeberka BBQ",
        "aliases": "żeberka,zeberka,ribs,żeberka bbq,zeberka bbq",
        "description": "Miękkie, lepkie żeberka w słodko-pikantnej glazurze.",
        "prep_minutes": 120, "servings": 4,
        "instructions": "1. Natrzyj żeberka przyprawami. 2. Wymieszaj miód, sos sojowy, "
                        "ketchup i czosnek na glazurę. 3. Piecz 90 min w 160°C, smarując glazurą.",
        "ingredients": [
            ("Żeberka wieprzowe", 1.0, "kg", False),
            ("Miód", 2.0, "łyżki", False),
            ("Sos sojowy", 60.0, "ml", False),
            ("Czosnek", 4.0, "ząbki", False),
            ("Ketchup", 100.0, "g", False),
            ("Papryka słodka", 1.0, "łyżka", False),
            ("Sól", 1.0, "szczypta", True),
            ("Pieprz", 1.0, "szczypta", True),
        ],
    },
    {
        "slug": "spaghetti-bolognese", "name": "Spaghetti Bolognese",
        "aliases": "spaghetti,bolognese,makaron bolognese",
        "description": "Klasyczny makaron z aromatycznym sosem mięsno-pomidorowym.",
        "prep_minutes": 40, "servings": 4,
        "instructions": "1. Podsmaż cebulę i czosnek. 2. Dodaj mięso, obsmaż. 3. Wlej passatę, "
                        "duś 20 min. 4. Ugotuj makaron i podawaj z sosem.",
        "ingredients": [
            ("Makaron spaghetti", 400.0, "g", False),
            ("Mięso mielone", 500.0, "g", False),
            ("Passata pomidorowa", 500.0, "ml", False),
            ("Cebula", 1.0, "szt.", False),
            ("Czosnek", 2.0, "ząbki", False),
            ("Oliwa", 2.0, "łyżki", True),
            ("Sól", 1.0, "szczypta", True),
        ],
    },
    {
        "slug": "nalesniki", "name": "Naleśniki",
        "aliases": "naleśniki,nalesniki,pancakes,placki",
        "description": "Cienkie naleśniki na słodko lub wytrawnie.",
        "prep_minutes": 25, "servings": 4,
        "instructions": "1. Zmiksuj mąkę, mleko i jajka. 2. Smaż cienkie placki na patelni.",
        "ingredients": [
            ("Mąka pszenna", 250.0, "g", False),
            ("Mleko", 500.0, "ml", False),
            ("Jajka", 2.0, "szt.", False),
            ("Cukier", 1.0, "łyżka", True),
            ("Sól", 1.0, "szczypta", True),
        ],
    },
    {
        "slug": "jajecznica", "name": "Jajecznica",
        "aliases": "jajecznica,scrambled eggs,jajka",
        "description": "Szybka jajecznica na maśle.",
        "prep_minutes": 10, "servings": 2,
        "instructions": "1. Rozgrzej masło. 2. Wbij jajka, mieszaj do ścięcia. 3. Dopraw.",
        "ingredients": [
            ("Jajka", 4.0, "szt.", False),
            ("Masło", 20.0, "g", False),
            ("Sól", 1.0, "szczypta", True),
            ("Pieprz", 1.0, "szczypta", True),
        ],
    },
    {
        "slug": "salatka-grecka", "name": "Sałatka grecka",
        "aliases": "sałatka grecka,salatka grecka,greek salad,sałatka",
        "description": "Świeża sałatka z fetą i oliwkami.",
        "prep_minutes": 15, "servings": 2,
        "instructions": "1. Pokrój warzywa. 2. Dodaj fetę i oliwki. 3. Skrop oliwą.",
        "ingredients": [
            ("Pomidory", 3.0, "szt.", False),
            ("Ogórek", 1.0, "szt.", False),
            ("Ser feta", 200.0, "g", False),
            ("Oliwki", 100.0, "g", False),
            ("Cebula czerwona", 1.0, "szt.", False),
            ("Oliwa", 3.0, "łyżki", True),
        ],
    },
    {
        "slug": "rosol", "name": "Rosół",
        "aliases": "rosół,rosol,broth,zupa",
        "description": "Domowy rosół z kurczaka i włoszczyzny.",
        "prep_minutes": 120, "servings": 6,
        "instructions": "1. Zalej mięso i warzywa wodą. 2. Gotuj na wolnym ogniu 2 h. "
                        "3. Podawaj z makaronem.",
        "ingredients": [
            ("Kurczak", 1.0, "kg", False),
            ("Marchew", 3.0, "szt.", False),
            ("Pietruszka", 2.0, "szt.", False),
            ("Seler", 1.0, "szt.", False),
            ("Cebula", 1.0, "szt.", False),
            ("Makaron", 200.0, "g", False),
            ("Sól", 1.0, "szczypta", True),
        ],
    },
]


async def seed_recipes(db: AsyncSession | None = None) -> int:
    """Insert any missing default recipes. Idempotent. Returns count added."""
    own_session = db is None
    session = db or AsyncSessionLocal()
    added = 0
    try:
        existing = set((await session.execute(select(Recipe.slug))).scalars().all())
        for r in DEFAULT_RECIPES:
            if r["slug"] in existing:
                continue
            recipe = Recipe(
                slug=r["slug"], name=r["name"], aliases=r["aliases"],
                description=r["description"], instructions=r["instructions"],
                prep_minutes=r["prep_minutes"], servings=r["servings"], is_system=True,
            )
            for name, qty, unit, optional in r["ingredients"]:
                recipe.ingredients.append(
                    RecipeIngredient(name=name, quantity=qty, unit=unit, is_optional=optional)
                )
            session.add(recipe)
            added += 1
        if added:
            await session.commit()
            log.info("seed.recipes", added=added)
        return added
    finally:
        if own_session:
            await session.close()


async def seed_categories(db: AsyncSession | None = None) -> int:
    """Insert any missing default categories. Idempotent. Returns count added."""
    own_session = db is None
    session = db or AsyncSessionLocal()
    added = 0
    try:
        existing = set(
            (await session.execute(select(Category.name))).scalars().all()
        )
        for name, icon in DEFAULT_CATEGORIES:
            if name not in existing:
                session.add(Category(name=name, icon=icon, is_system=True))
                added += 1
        if added:
            await session.commit()
            log.info("seed.categories", added=added)
        return added
    finally:
        if own_session:
            await session.close()

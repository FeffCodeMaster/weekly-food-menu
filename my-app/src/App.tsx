import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';

type Dish = {
  id: string;
  name: string;
  ingredients: string[];
};

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DISHES_STORAGE_KEY = 'weekly-menu-dishes';
const PLAN_STORAGE_KEY = 'weekly-menu-plan';
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const createEmptyPlan = () =>
  daysOfWeek.reduce((acc, day) => {
    acc[day] = null;
    return acc;
  }, {} as Record<string, string | null>);

const loadDishesFromStorage = (): Dish[] => {
  if (!isBrowser) return [];
  try {
    const saved = window.localStorage.getItem(DISHES_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const name = typeof item.name === 'string' ? item.name : '';
        const ingredients = Array.isArray(item.ingredients)
          ? item.ingredients.map((ing: any) => (typeof ing === 'string' ? ing : '')).filter(Boolean)
          : [];
        const id = typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        if (!name) return null;
        return { id, name, ingredients };
      })
      .filter(Boolean) as Dish[];
  } catch {
    return [];
  }
};

const loadPlanFromStorage = (): Record<string, string | null> => {
  const base = createEmptyPlan();
  if (!isBrowser) return base;
  try {
    const saved = window.localStorage.getItem(PLAN_STORAGE_KEY);
    if (!saved) return base;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      daysOfWeek.forEach((day) => {
        const value = parsed[day];
        if (typeof value === 'string' || value === null) {
          base[day] = value;
        }
      });
    }
    return base;
  } catch {
    return base;
  }
};

function App() {
  const [activeView, setActiveView] = useState<'dishes' | 'planner' | 'shopping'>('dishes');
  const [dishes, setDishes] = useState<Dish[]>(loadDishesFromStorage);
  const [dishName, setDishName] = useState('');
  const [dishIngredients, setDishIngredients] = useState('');
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingIngredients, setEditingIngredients] = useState('');
  const [weeklyPlan, setWeeklyPlan] = useState<Record<string, string | null>>(loadPlanFromStorage);

  const dishOptions = useMemo(() => dishes.map((dish) => ({ value: dish.id, label: dish.name })), [dishes]);

  const shoppingItems = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    daysOfWeek.forEach((day) => {
      const dishId = weeklyPlan[day];
      if (!dishId) return;
      const dish = dishes.find((item) => item.id === dishId);
      if (!dish) return;
      dish.ingredients.forEach((ingredient) => {
        const key = ingredient.toLowerCase();
        if (!counts[key]) {
          counts[key] = { name: ingredient, count: 0 };
        }
        counts[key].count += 1;
      });
    });
    return Object.values(counts).sort((a, b) => a.name.localeCompare(b.name));
  }, [dishes, weeklyPlan]);

  useEffect(() => {
    if (!isBrowser) return;
    window.localStorage.setItem(DISHES_STORAGE_KEY, JSON.stringify(dishes));
  }, [dishes]);

  useEffect(() => {
    if (!isBrowser) return;
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(weeklyPlan));
  }, [weeklyPlan]);

  const addDish = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = dishName.trim();

    if (!trimmedName) {
      return;
    }
    const ingredients = dishIngredients
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const newDish: Dish = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmedName,
      ingredients,
    };

    setDishes((prev) => [...prev, newDish]);
    setDishName('');
    setDishIngredients('');
  };

  const startEdit = (dish: Dish) => {
    setEditingDishId(dish.id);
    setEditingName(dish.name);
    setEditingIngredients(dish.ingredients.join(', '));
  };

  const cancelEdit = () => {
    setEditingDishId(null);
    setEditingName('');
    setEditingIngredients('');
  };

  const saveEdit = () => {
    if (!editingDishId) {
      return;
    }
    const trimmed = editingName.trim();
    if (!trimmed) {
      return;
    }
    const ingredients = editingIngredients
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setDishes((prev) =>
      prev.map((dish) => (dish.id === editingDishId ? { ...dish, name: trimmed, ingredients } : dish)),
    );
    cancelEdit();
  };

  const removeDish = (dishId: string) => {
    if (editingDishId === dishId) {
      cancelEdit();
    }
    setDishes((prev) => prev.filter((dish) => dish.id !== dishId));
    setWeeklyPlan((prev) => {
      const updated = { ...prev };
      Object.entries(prev).forEach(([day, plannedId]) => {
        if (plannedId === dishId) {
          updated[day] = null;
        }
      });
      return updated;
    });
  };

  const assignDishToDay = (day: string, dishId: string) => {
    setWeeklyPlan((prev) => ({ ...prev, [day]: dishId || null }));
  };

  const plannedDishName = (dishId: string | null) => dishes.find((dish) => dish.id === dishId)?.name || 'Pick a dish';

  const clearPlan = (day: string) => assignDishToDay(day, '');

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Weekly menu</p>
          <h1>Plan dinners without the scramble</h1>
          <p className="lede">Add dishes once, then plan the week whenever it suits you.</p>
        </div>
        <div className="view-toggle" role="tablist" aria-label="View selector">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'dishes'}
            className={activeView === 'dishes' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('dishes')}
          >
            Dish library
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'planner'}
            className={activeView === 'planner' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('planner')}
          >
            Weekly planner
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'shopping'}
            className={activeView === 'shopping' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('shopping')}
          >
            Shopping list
          </button>
        </div>
      </header>

      {activeView === 'dishes' ? (
        <main className="grid two">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2>Add your go-to dishes</h2>
                <p className="subtext">Add ingredient tags so you remember what to buy.</p>
              </div>
              <button className="ghost" type="button" onClick={() => setActiveView('planner')}>
                Go to planner
              </button>
            </div>
            <form className="form" onSubmit={addDish}>
              <label className="field">
                <span>Dish name</span>
                <input
                  type="text"
                  value={dishName}
                  onChange={(event) => setDishName(event.target.value)}
                  placeholder="E.g. Lemon chicken pasta"
                  required
                />
              </label>
              <label className="field">
                <span>Ingredients (comma-separated)</span>
                <input
                  type="text"
                  value={dishIngredients}
                  onChange={(event) => setDishIngredients(event.target.value)}
                  placeholder="Chicken, pasta, lemon, parmesan"
                />
              </label>
              <button className="primary" type="submit" disabled={!dishName.trim()}>
                Save dish
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Your dishes</p>
                <h2>Reusable list</h2>
                <p className="subtext">Add once and reuse in your weekly plan.</p>
              </div>
            </div>
            {dishes.length === 0 ? (
              <div className="empty">
                <p>No dishes yet.</p>
                <p className="subtext">Add a few favorites, then start planning.</p>
              </div>
            ) : (
              <ul className="dish-list">
                {dishes.map((dish) => (
                  <li key={dish.id} className={editingDishId === dish.id ? 'dish-card editing' : 'dish-card'}>
                    {editingDishId === dish.id ? (
                      <div className="edit-fields">
                        <label className="field">
                          <span>Dish name</span>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            placeholder="E.g. Lemon chicken pasta"
                            required
                          />
                        </label>
                        <label className="field">
                          <span>Ingredients (comma-separated)</span>
                          <input
                            type="text"
                            value={editingIngredients}
                            onChange={(event) => setEditingIngredients(event.target.value)}
                            placeholder="Chicken, pasta, lemon, parmesan"
                          />
                        </label>
                        <div className="dish-actions">
                          <button className="primary" type="button" onClick={saveEdit} disabled={!editingName.trim()}>
                            Save
                          </button>
                          <button className="ghost" type="button" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="dish-name">{dish.name}</p>
                          <div className="ingredient-list" aria-label="Ingredients">
                            {dish.ingredients.length === 0 ? (
                              <span className="pill muted">No ingredients</span>
                            ) : (
                              dish.ingredients.map((ingredient, index) => (
                                <span key={`${dish.id}-${ingredient}-${index}`} className="pill">
                                  {ingredient}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="dish-actions">
                          <span className="pill">Ready for planner</span>
                          <button
                            className="ghost"
                            type="button"
                            aria-label={`Edit ${dish.name}`}
                            onClick={() => startEdit(dish)}
                          >
                            Edit
                          </button>
                          <button
                            className="ghost danger"
                            type="button"
                            aria-label={`Remove ${dish.name}`}
                            onClick={() => removeDish(dish.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      ) : activeView === 'planner' ? (
        <main className="grid two">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>Plan the week</h2>
                <p className="subtext">Pick a dinner for each day. Change plans any time.</p>
              </div>
              <button className="ghost" type="button" onClick={() => setActiveView('dishes')}>
                Add more dishes
              </button>
            </div>
            {dishes.length === 0 ? (
              <div className="empty">
                <p>Add dishes first</p>
                <p className="subtext">Go to the Dish library to create a few options.</p>
                <button className="primary" type="button" onClick={() => setActiveView('dishes')}>
                  Go to dishes
                </button>
              </div>
            ) : (
              <div className="week">
                {daysOfWeek.map((day) => (
                  <div key={day} className="day-row">
                    <div className="day-label">
                      <p className="eyebrow">{day}</p>
                      <p className="day-dish">{plannedDishName(weeklyPlan[day])}</p>
                    </div>
                    <div className="day-actions">
                      <select
                        value={weeklyPlan[day] || ''}
                        onChange={(event) => assignDishToDay(day, event.target.value)}
                      >
                        <option value="">Pick a dish</option>
                        {dishOptions.map((dish) => (
                          <option key={dish.value} value={dish.value}>
                            {dish.label}
                          </option>
                        ))}
                      </select>
                      <button className="ghost" type="button" onClick={() => clearPlan(day)}>
                        Clear
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Overview</p>
                <h2>Week at a glance</h2>
                <p className="subtext">Share the plan or prep your shopping list.</p>
              </div>
              <button className="ghost" type="button" onClick={() => setActiveView('shopping')}>
                View shopping list
              </button>
            </div>
            <div className="summary">
              {daysOfWeek.map((day) => (
                <div key={day} className="summary-row">
                  <span>{day}</span>
                  <span className="summary-dish">
                    {weeklyPlan[day] ? plannedDishName(weeklyPlan[day]) : 'Not planned'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <main className="grid two">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Shopping list</h2>
                <p className="subtext">Built from the dishes you have planned this week.</p>
              </div>
              <button className="ghost" type="button" onClick={() => setActiveView('planner')}>
                Back to planner
              </button>
            </div>
            {shoppingItems.length === 0 ? (
              <div className="empty">
                <p>No ingredients yet.</p>
                <p className="subtext">Plan at least one dish to generate the list.</p>
                <div className="dish-actions">
                  <button className="ghost" type="button" onClick={() => setActiveView('planner')}>
                    Plan dishes
                  </button>
                  <button className="primary" type="button" onClick={() => setActiveView('dishes')}>
                    Add dishes
                  </button>
                </div>
              </div>
            ) : (
              <div className="shopping-list">
                {shoppingItems.map((item) => (
                  <div key={item.name} className="shopping-row">
                    <span>{item.name}</span>
                    <span className="shopping-count" aria-label={`${item.count} times`}>
                      x{item.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Planned dishes</p>
                <h2>Overview</h2>
                <p className="subtext">See what contributes to the list.</p>
              </div>
            </div>
            <div className="summary">
              {daysOfWeek.map((day) => (
                <div key={day} className="summary-row">
                  <span>{day}</span>
                  <span className="summary-dish">
                    {weeklyPlan[day] ? plannedDishName(weeklyPlan[day]) : 'Not planned'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;

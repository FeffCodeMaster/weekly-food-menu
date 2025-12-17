import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';
import defaultDishes from './defaultDishes.json';

type Dish = {
  id: string;
  name: string;
  ingredients: string[];
  includeInPlanner?: boolean;
  isDefault?: boolean;
  special?: boolean;
};

type DayPlan = {
  primary: string | null;
  secondary: string | null;
};

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DISHES_STORAGE_KEY = 'weekly-menu-dishes';
const PLAN_STORAGE_KEY = 'weekly-menu-plan';
const AVAILABLE_STORAGE_KEY = 'weekly-menu-available';
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const createEmptyPlan = () =>
  daysOfWeek.reduce((acc, day) => {
    acc[day] = { primary: null, secondary: null };
    return acc;
  }, {} as Record<string, DayPlan>);

const normalizeDish = (item: any): Dish | null => {
  if (!item || typeof item !== 'object') return null;
  const name = typeof item.name === 'string' ? item.name : '';
  const ingredients = Array.isArray(item.ingredients)
    ? item.ingredients.map((ing: any) => (typeof ing === 'string' ? ing : '')).filter(Boolean)
    : [];
  const id = typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const includeInPlanner = item.includeInPlanner !== false;
  const isDefault = item.isDefault === true;
  const special = item.special === true;
  if (!name) return null;
  return { id, name, ingredients, includeInPlanner, isDefault, special };
};

const loadDishesFromStorage = (): Dish[] => {
  if (!isBrowser) return [];
  try {
    const saved = window.localStorage.getItem(DISHES_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeDish(item)).filter(Boolean) as Dish[];
  } catch {
    return [];
  }
};

const mergeWithDefaults = (stored: Dish[]): Dish[] => {
  const base = (defaultDishes as Dish[]).map((dish) => ({
    ...dish,
    includeInPlanner: dish.includeInPlanner !== false,
    isDefault: true,
  }));
  const byId = new Map<string, Dish>();
  base.forEach((dish) => byId.set(dish.id, dish));
  stored.forEach((dish) => {
    const normalized = normalizeDish(dish);
    if (!normalized) return;
    const existing = byId.get(normalized.id);
    byId.set(normalized.id, existing ? { ...existing, ...normalized, isDefault: existing.isDefault || normalized.isDefault } : normalized);
  });
  return Array.from(byId.values());
};

const loadPlanFromStorage = (): Record<string, DayPlan> => {
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
          base[day] = { primary: value, secondary: null };
        } else if (value && typeof value === 'object') {
          const primary = typeof value.primary === 'string' || value.primary === null ? value.primary : null;
          const secondary = typeof value.secondary === 'string' || value.secondary === null ? value.secondary : null;
          base[day] = { primary, secondary };
        }
      });
    }
    return base;
  } catch {
    return base;
  }
};

const loadAvailableFromStorage = (): Record<string, boolean> => {
  if (!isBrowser) return {};
  try {
    const saved = window.localStorage.getItem(AVAILABLE_STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
};

const ingredientKey = (name: string) => name.trim().toLowerCase();

function App() {
  const [activeView, setActiveView] = useState<'dishes' | 'planner' | 'shopping'>('planner');
  const [dishes, setDishes] = useState<Dish[]>(() => mergeWithDefaults(loadDishesFromStorage()));
  const [dishName, setDishName] = useState('');
  const [dishIngredients, setDishIngredients] = useState('');
  const [dishIsSpecial, setDishIsSpecial] = useState(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingIngredients, setEditingIngredients] = useState('');
  const [editingSpecial, setEditingSpecial] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState<Record<string, DayPlan>>(loadPlanFromStorage);
  const [availableAtHome, setAvailableAtHome] = useState<Record<string, boolean>>(loadAvailableFromStorage);

  const dishOptions = useMemo(
    () => dishes.filter((dish) => dish.includeInPlanner !== false).map((dish) => ({ value: dish.id, label: dish.name })),
    [dishes],
  );

  const shoppingItems = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    const addIngredientsForDish = (dishId: string | null) => {
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
    };
    daysOfWeek.forEach((day) => {
      addIngredientsForDish(weeklyPlan[day]?.primary || null);
      addIngredientsForDish(weeklyPlan[day]?.secondary || null);
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

  useEffect(() => {
    if (!isBrowser) return;
    window.localStorage.setItem(AVAILABLE_STORAGE_KEY, JSON.stringify(availableAtHome));
  }, [availableAtHome]);

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
      includeInPlanner: true,
      special: dishIsSpecial,
    };

    setDishes((prev) => [...prev, newDish]);
    setDishName('');
    setDishIngredients('');
    setDishIsSpecial(false);
  };

  const startEdit = (dish: Dish) => {
    setEditingDishId(dish.id);
    setEditingName(dish.name);
    setEditingIngredients(dish.ingredients.join(', '));
    setEditingSpecial(Boolean(dish.special));
  };

  const cancelEdit = () => {
    setEditingDishId(null);
    setEditingName('');
    setEditingIngredients('');
    setEditingSpecial(false);
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
      prev.map((dish) =>
        dish.id === editingDishId ? { ...dish, name: trimmed, ingredients, special: editingSpecial } : dish,
      ),
    );
    cancelEdit();
  };

  const removeDish = (dishId: string) => {
    const target = dishes.find((dish) => dish.id === dishId);
    if (target?.isDefault) {
      return;
    }
    if (editingDishId === dishId) {
      cancelEdit();
    }
    setDishes((prev) => prev.filter((dish) => dish.id !== dishId));
    setWeeklyPlan((prev) => {
      const updated = { ...prev };
      Object.entries(prev).forEach(([day, planned]) => {
        const primary = planned.primary === dishId ? null : planned.primary;
        const secondary = planned.secondary === dishId ? null : planned.secondary;
        updated[day] = { primary, secondary };
      });
      return updated;
    });
  };

  const assignDishToDay = (day: string, slot: 'primary' | 'secondary', dishId: string) => {
    setWeeklyPlan((prev) => {
      const dish = dishes.find((item) => item.id === dishId);
      if (dish?.special) {
        const otherSpecialPlanned = Object.entries(prev).some(([existingDay, planned]) => {
          const slots: Array<[string, string | null]> = [
            ['primary', planned.primary],
            ['secondary', planned.secondary],
          ];
          return slots.some(([slotName, plannedId]) => {
            if (existingDay === day && slotName === slot) return false;
            if (!plannedId) return false;
            const plannedDish = dishes.find((item) => item.id === plannedId);
            return plannedDish?.special;
          });
        });
        if (otherSpecialPlanned) {
          return prev;
        }
      }
      return { ...prev, [day]: { ...prev[day], [slot]: dishId || null } };
    });
  };

  const toggleIncludeInPlanner = (dishId: string, include: boolean) => {
    setDishes((prev) =>
      prev.map((dish) => (dish.id === dishId ? { ...dish, includeInPlanner: include } : dish)),
    );
    if (!include) {
      setWeeklyPlan((prev) => {
        const updated = { ...prev };
        Object.entries(prev).forEach(([day, planned]) => {
          const primary = planned.primary === dishId ? null : planned.primary;
          const secondary = planned.secondary === dishId ? null : planned.secondary;
          updated[day] = { primary, secondary };
        });
        return updated;
      });
    }
  };

  const plannedDishName = (dishId: string | null) => dishes.find((dish) => dish.id === dishId)?.name || 'Pick a dish';

  const clearPlan = (day: string, slot: 'primary' | 'secondary') => assignDishToDay(day, slot, '');

  const toggleAvailable = (name: string, available: boolean) => {
    const key = ingredientKey(name);
    setAvailableAtHome((prev) => ({ ...prev, [key]: available }));
  };

  const hasSpecialElsewhere = (day: string, slot: 'primary' | 'secondary') => {
    return Object.entries(weeklyPlan).some(([existingDay, planned]) => {
      const slots: Array<[string, string | null]> = [
        ['primary', planned.primary],
        ['secondary', planned.secondary],
      ];
      return slots.some(([slotName, plannedId]) => {
        if (existingDay === day && slotName === slot) return false;
        if (!plannedId) return false;
        const plannedDish = dishes.find((item) => item.id === plannedId);
        return plannedDish?.special;
      });
    });
  };

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
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={dishIsSpecial}
                  onChange={(event) => setDishIsSpecial(event.target.checked)}
                />
                <span>Mark as special (once per week)</span>
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
          <p className="subtext">Special dishes can only be planned once per week.</p>
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
                        <label className="inline-toggle">
                          <input
                            type="checkbox"
                            checked={editingSpecial}
                            onChange={(event) => setEditingSpecial(event.target.checked)}
                          />
                          <span>Mark as special (once per week)</span>
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
                        <div className="planner-toggle">
                          <label className="inline-toggle">
                            <input
                              type="checkbox"
                              checked={dish.includeInPlanner !== false}
                              onChange={(event) => toggleIncludeInPlanner(dish.id, event.target.checked)}
                            />
                            <span>Show in planner</span>
                          </label>
                        </div>
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
                          <div className="pill-row">
                            {dish.isDefault ? <span className="pill muted">Default</span> : <span className="pill">Ready for planner</span>}
                            {dish.special && <span className="pill accent">Special</span>}
                          </div>
                          <button
                            className="ghost"
                            type="button"
                            aria-label={`Edit ${dish.name}`}
                            onClick={() => startEdit(dish)}
                          >
                            Edit
                          </button>
                          {!dish.isDefault && (
                            <button
                              className="ghost danger"
                              type="button"
                              aria-label={`Remove ${dish.name}`}
                              onClick={() => removeDish(dish.id)}
                            >
                              Remove
                            </button>
                          )}
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
                      <p className="day-dish">{plannedDishName(weeklyPlan[day]?.primary || null)}</p>
                      <p className="day-subdish">
                        {weeklyPlan[day]?.secondary ? plannedDishName(weeklyPlan[day]?.secondary || null) : 'No secondary'}
                      </p>
                    </div>
                    <div className="day-actions">
                      <div className="select-group">
                        <label className="select-label">Primary</label>
                        <select
                          value={weeklyPlan[day]?.primary || ''}
                          onChange={(event) => assignDishToDay(day, 'primary', event.target.value)}
                        >
                          <option value="">Pick a dish</option>
                          {dishOptions.map((dish) => {
                            const specialDish = dishes.find((item) => item.id === dish.value);
                            const isDisabled = specialDish?.special && hasSpecialElsewhere(day, 'primary');
                            return (
                              <option key={dish.value} value={dish.value} disabled={isDisabled}>
                                {dish.label}
                                {specialDish?.special ? ' (special)' : ''}
                              </option>
                            );
                          })}
                        </select>
                        <button className="ghost" type="button" onClick={() => clearPlan(day, 'primary')}>
                          Clear
                        </button>
                      </div>
                      <div className="select-group">
                        <label className="select-label">Secondary</label>
                        <select
                          value={weeklyPlan[day]?.secondary || ''}
                          onChange={(event) => assignDishToDay(day, 'secondary', event.target.value)}
                        >
                          <option value="">Pick a dish</option>
                          {dishOptions.map((dish) => {
                            const specialDish = dishes.find((item) => item.id === dish.value);
                            const isDisabled = specialDish?.special && hasSpecialElsewhere(day, 'secondary');
                            return (
                              <option key={dish.value} value={dish.value} disabled={isDisabled}>
                                {dish.label}
                                {specialDish?.special ? ' (special)' : ''}
                              </option>
                            );
                          })}
                        </select>
                        <button className="ghost" type="button" onClick={() => clearPlan(day, 'secondary')}>
                          Clear
                        </button>
                      </div>
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
                    {(() => {
                      const primaryName = weeklyPlan[day]?.primary ? plannedDishName(weeklyPlan[day]?.primary) : '';
                      const secondaryName = weeklyPlan[day]?.secondary ? plannedDishName(weeklyPlan[day]?.secondary) : '';
                      const names = [primaryName, secondaryName].filter(Boolean).join(' • ');
                      return names || 'Not planned';
                    })()}
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
                <h2>Required ingredients</h2>
                <p className="subtext">Mark what you already have at home to build the final shopping list.</p>
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
                {shoppingItems.map((item) => {
                  const key = ingredientKey(item.name);
                  const available = Boolean(availableAtHome[key]);
                  return (
                    <label key={item.name} className="shopping-row">
                      <div className="shopping-main">
                        <input
                          type="checkbox"
                          checked={available}
                          aria-label={`Mark ${item.name} available at home`}
                          onChange={(event) => toggleAvailable(item.name, event.target.checked)}
                        />
                        <span className={available ? 'ingredient-available' : ''}>{item.name}</span>
                      </div>
                      <span className="shopping-count" aria-label={`${item.count} times`}>
                        x{item.count}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">To buy</p>
                <h2>Shopping list</h2>
                <p className="subtext">Only items not marked as available at home.</p>
              </div>
            </div>
            {shoppingItems.filter((item) => !availableAtHome[ingredientKey(item.name)]).length === 0 ? (
              <div className="empty">
                <p>Everything is already at home.</p>
                <p className="subtext">Uncheck items on the left to add them back to the shopping list.</p>
              </div>
            ) : (
              <div className="shopping-list">
                {shoppingItems
                  .filter((item) => !availableAtHome[ingredientKey(item.name)])
                  .map((item) => (
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
        </main>
      )}
    </div>
  );
}

export default App;

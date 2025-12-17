import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
});

test('renders weekly planner view by default', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /plan dinners without the scramble/i })).toBeInTheDocument();
  const plannerTab = screen.getByRole('tab', { name: /weekly planner/i });
  expect(plannerTab).toHaveAttribute('aria-selected', 'true');
});

test('allows adding and removing a dish', async () => {
  render(<App />);

  await userEvent.type(screen.getByLabelText(/dish name/i), 'Tacos');
  await userEvent.type(screen.getByLabelText(/ingredients/i), 'Tortillas, beans');
  await userEvent.click(screen.getByRole('button', { name: /save dish/i }));

  expect(screen.getByText(/tacos/i)).toBeInTheDocument();
  expect(screen.getByText(/tortillas/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /remove tacos/i }));

  expect(screen.queryByText(/tacos/i)).not.toBeInTheDocument();
});

test('allows editing a dish name and ingredients', async () => {
  render(<App />);

  await userEvent.type(screen.getByLabelText(/dish name/i), 'Pasta');
  await userEvent.type(screen.getByLabelText(/ingredients/i), 'Pasta, tomato sauce');
  await userEvent.click(screen.getByRole('button', { name: /save dish/i }));

  await userEvent.click(screen.getByRole('button', { name: /edit pasta/i }));

  const nameInput = screen.getByLabelText(/dish name/i);
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'Pasta pesto');

  const ingredientInput = screen.getByLabelText(/ingredients/i);
  await userEvent.clear(ingredientInput);
  await userEvent.type(ingredientInput, 'Pasta, pesto, parmesan');

  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

  expect(screen.getByText(/pasta pesto/i)).toBeInTheDocument();
  expect(screen.getByText(/pesto/i)).toBeInTheDocument();
  expect(screen.getByText(/parmesan/i)).toBeInTheDocument();
});

test('builds a shopping list from planned dishes', async () => {
  render(<App />);

  await userEvent.type(screen.getByLabelText(/dish name/i), 'Tacos');
  await userEvent.type(screen.getByLabelText(/ingredients/i), 'Tortillas, beans');
  await userEvent.click(screen.getByRole('button', { name: /save dish/i }));

  await userEvent.click(screen.getByRole('tab', { name: /weekly planner/i }));

  const selects = screen.getAllByRole('combobox');
  await userEvent.selectOptions(selects[0], screen.getByText(/tacos/i));

  await userEvent.click(screen.getByRole('tab', { name: /shopping list/i }));

  expect(screen.getByText(/tortillas/i)).toBeInTheDocument();
  expect(screen.getByText(/beans/i)).toBeInTheDocument();
});

test('can hide a dish from the planner dropdown', async () => {
  render(<App />);

  await userEvent.type(screen.getByLabelText(/dish name/i), 'Soup');
  await userEvent.type(screen.getByLabelText(/ingredients/i), 'Broth, carrots');
  await userEvent.click(screen.getByRole('button', { name: /save dish/i }));

  const toggles = screen.getAllByLabelText(/show in planner/i);
  await userEvent.click(toggles[toggles.length - 1]);

  await userEvent.click(screen.getByRole('tab', { name: /weekly planner/i }));
  const options = screen.queryAllByRole('option', { name: /soup/i });
  expect(options.length).toBe(0);
});

test('only one special dish can be planned per week', async () => {
  render(<App />);

  await userEvent.type(screen.getByLabelText(/dish name/i), 'Prime Rib');
  await userEvent.type(screen.getByLabelText(/ingredients/i), 'Beef, salt');
  await userEvent.click(screen.getByLabelText(/mark as special/i));
  await userEvent.click(screen.getByRole('button', { name: /save dish/i }));

  await userEvent.type(screen.getByLabelText(/dish name/i), 'Seafood');
  await userEvent.type(screen.getByLabelText(/ingredients/i), 'Shrimp');
  await userEvent.click(screen.getByLabelText(/mark as special/i));
  await userEvent.click(screen.getByRole('button', { name: /save dish/i }));

  await userEvent.click(screen.getByRole('tab', { name: /weekly planner/i }));

  const selects = screen.getAllByRole('combobox');
  await userEvent.selectOptions(selects[0], screen.getByText(/prime rib/i));

  const seafoodOption = within(selects[1]).getByRole('option', { name: /seafood/i });
  expect(seafoodOption).toBeDisabled();
});

test('marking an ingredient available removes it from the final shopping list', async () => {
  render(<App />);

  await userEvent.type(screen.getByLabelText(/dish name/i), 'Tacos');
  await userEvent.type(screen.getByLabelText(/ingredients/i), 'Tortillas, beans');
  await userEvent.click(screen.getByRole('button', { name: /save dish/i }));

  await userEvent.click(screen.getByRole('tab', { name: /weekly planner/i }));
  const selects = screen.getAllByRole('combobox');
  await userEvent.selectOptions(selects[0], screen.getByText(/tacos/i));

  await userEvent.click(screen.getByRole('tab', { name: /shopping list/i }));

  const toBuyHeading = screen.getByRole('heading', { name: /^shopping list$/i });
  const toBuyPanel = toBuyHeading.closest('.panel');
  expect(toBuyPanel).not.toBeNull();
  const toBuyScope = within(toBuyPanel as HTMLElement);
  expect(toBuyScope.getByText(/tortillas/i)).toBeInTheDocument();

  await userEvent.click(screen.getByLabelText(/mark tortillas available at home/i));

  expect(toBuyScope.queryByText(/tortillas/i)).not.toBeInTheDocument();
  expect(toBuyScope.getByText(/beans/i)).toBeInTheDocument();
});

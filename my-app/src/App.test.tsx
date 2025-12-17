import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
});

test('renders dish library view by default', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /plan dinners without the scramble/i })).toBeInTheDocument();
  const dishLibraryTab = screen.getByRole('tab', { name: /dish library/i });
  expect(dishLibraryTab).toHaveAttribute('aria-selected', 'true');
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

  const selects = screen.getAllByRole('combobox');
  await userEvent.selectOptions(selects[0], screen.getByText(/tacos/i));

  await userEvent.click(screen.getByRole('tab', { name: /shopping list/i }));

  expect(screen.getByText(/tortillas/i)).toBeInTheDocument();
  expect(screen.getByText(/beans/i)).toBeInTheDocument();
});

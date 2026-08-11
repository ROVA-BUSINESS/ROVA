/*
  # Fix Account Balance Real-time Triggers & Recalculation

  1. Enhancements to `accounts` table:
    - Ensure `last_synced_at` column exists
    - Ensure `mono_account_id` index exists

  2. Triggers:
    - Automatically update `accounts.balance` whenever a transaction is inserted, updated, or deleted.

  3. Functions:
    - `recalculate_account_balance`: Helper function to recalculate exact account balance from linked transactions.
*/

-- Ensure columns exist
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS mono_account_id text;

-- Create index on mono_account_id if not exists
CREATE INDEX IF NOT EXISTS idx_accounts_mono_account_id ON public.accounts(mono_account_id)
  WHERE mono_account_id IS NOT NULL;

-- Trigger Function to update account balance on transaction change
CREATE OR REPLACE FUNCTION public.update_account_balance_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. On INSERT
  IF (TG_OP = 'INSERT') THEN
    IF NEW.account_id IS NOT NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) + NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) - NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;

  -- 2. On DELETE
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.account_id IS NOT NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) - OLD.amount,
            updated_at = now()
        WHERE id = OLD.account_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) + OLD.amount,
            updated_at = now()
        WHERE id = OLD.account_id;
      END IF;
    END IF;
    RETURN OLD;

  -- 3. On UPDATE
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Revert OLD effect
    IF OLD.account_id IS NOT NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) - OLD.amount,
            updated_at = now()
        WHERE id = OLD.account_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) + OLD.amount,
            updated_at = now()
        WHERE id = OLD.account_id;
      END IF;
    END IF;

    -- Apply NEW effect
    IF NEW.account_id IS NOT NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) + NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) - NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to transactions table
DROP TRIGGER IF EXISTS trg_update_account_balance ON public.transactions;

CREATE TRIGGER trg_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_account_balance_on_transaction();

-- Recalculate helper function
CREATE OR REPLACE FUNCTION public.recalculate_account_balance(target_account_id uuid)
RETURNS numeric AS $$
DECLARE
  total_income numeric := 0;
  total_expense numeric := 0;
  calculated_balance numeric := 0;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_income
  FROM public.transactions
  WHERE account_id = target_account_id AND type = 'income';

  SELECT COALESCE(SUM(amount), 0) INTO total_expense
  FROM public.transactions
  WHERE account_id = target_account_id AND type = 'expense';

  calculated_balance := total_income - total_expense;

  UPDATE public.accounts
  SET balance = calculated_balance,
      updated_at = now()
  WHERE id = target_account_id;

  RETURN calculated_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

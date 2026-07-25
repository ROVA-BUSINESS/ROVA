-- Create automatic activity logging trigger function
CREATE OR REPLACE FUNCTION public.log_activity_trigger()
RETURNS TRIGGER AS $$
DECLARE
  owner_uuid uuid;
  user_uuid uuid;
  action_name text;
  entity_lbl text;
  meta jsonb;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_name := 'created';
    
    -- Try to get owner_id or user_id
    IF NEW.user_id IS NOT NULL THEN
      user_uuid := NEW.user_id;
      owner_uuid := NEW.user_id;
    ELSE
      user_uuid := auth.uid();
      owner_uuid := auth.uid();
    END IF;
    
    -- Set entity label and metadata based on table
    IF TG_TABLE_NAME = 'transactions' THEN
      entity_lbl := COALESCE(NEW.description, '');
      meta := jsonb_build_object('amount', NEW.amount, 'type', NEW.type);
    ELSIF TG_TABLE_NAME = 'invoices' THEN
      entity_lbl := COALESCE(NEW.invoice_number, '');
      meta := jsonb_build_object('total', NEW.total, 'client', NEW.client_name);
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
      entity_lbl := COALESCE(NEW.name, '');
      meta := jsonb_build_object('sku', NEW.sku, 'stock', NEW.current_stock);
    ELSIF TG_TABLE_NAME = 'employees' THEN
      entity_lbl := COALESCE(NEW.full_name, '');
      meta := jsonb_build_object('role', NEW.role, 'salary', NEW.gross_salary);
    ELSE
      entity_lbl := TG_TABLE_NAME;
      meta := '{}'::jsonb;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'updated';
    
    IF NEW.user_id IS NOT NULL THEN
      user_uuid := NEW.user_id;
      owner_uuid := NEW.user_id;
    ELSE
      user_uuid := auth.uid();
      owner_uuid := auth.uid();
    END IF;
    
    IF TG_TABLE_NAME = 'transactions' THEN
      entity_lbl := COALESCE(NEW.description, '');
      meta := jsonb_build_object('old_amount', OLD.amount, 'new_amount', NEW.amount);
    ELSIF TG_TABLE_NAME = 'invoices' THEN
      entity_lbl := COALESCE(NEW.invoice_number, '');
      meta := jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status);
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
      entity_lbl := COALESCE(NEW.name, '');
      meta := jsonb_build_object('old_stock', OLD.current_stock, 'new_stock', NEW.current_stock);
    ELSE
      entity_lbl := TG_TABLE_NAME;
      meta := '{}'::jsonb;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'deleted';
    
    IF OLD.user_id IS NOT NULL THEN
      user_uuid := OLD.user_id;
      owner_uuid := OLD.user_id;
    ELSE
      user_uuid := auth.uid();
      owner_uuid := auth.uid();
    END IF;
    
    IF TG_TABLE_NAME = 'transactions' THEN
      entity_lbl := COALESCE(OLD.description, '');
      meta := jsonb_build_object('amount', OLD.amount);
    ELSIF TG_TABLE_NAME = 'invoices' THEN
      entity_lbl := COALESCE(OLD.invoice_number, '');
      meta := jsonb_build_object('total', OLD.total);
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
      entity_lbl := COALESCE(OLD.name, '');
      meta := jsonb_build_object('sku', OLD.sku);
    ELSE
      entity_lbl := TG_TABLE_NAME;
      meta := '{}'::jsonb;
    END IF;
  END IF;

  -- Ensure user_uuid defaults to active authenticated user or owner_uuid
  IF user_uuid IS NULL THEN
    user_uuid := COALESCE(auth.uid(), owner_uuid);
  END IF;

  -- Log action if both owner and user are identified
  IF owner_uuid IS NOT NULL AND user_uuid IS NOT NULL THEN
    INSERT INTO public.activity_logs (user_id, owner_id, action, entity_type, entity_id, entity_label, metadata)
    VALUES (user_uuid, owner_uuid, action_name, TG_TABLE_NAME, COALESCE(NEW.id::text, OLD.id::text), entity_lbl, meta);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to core tables
DROP TRIGGER IF EXISTS trg_log_transactions_activity ON public.transactions;
CREATE TRIGGER trg_log_transactions_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();

DROP TRIGGER IF EXISTS trg_log_invoices_activity ON public.invoices;
CREATE TRIGGER trg_log_invoices_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();

DROP TRIGGER IF EXISTS trg_log_inventory_items_activity ON public.inventory_items;
CREATE TRIGGER trg_log_inventory_items_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();

DROP TRIGGER IF EXISTS trg_log_employees_activity ON public.employees;
CREATE TRIGGER trg_log_employees_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();

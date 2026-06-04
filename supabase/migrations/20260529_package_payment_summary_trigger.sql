-- Trigger to update bookings.total_paid, next_payment_date, next_payment_amount
-- when booking_package_payments are inserted/updated/deleted.
-- Mirrors the existing trigger on legacy booking_payments table.

CREATE OR REPLACE FUNCTION refresh_booking_package_payment_summary()
RETURNS TRIGGER AS $$
DECLARE
  target_booking_id uuid;
BEGIN
  -- Get booking_id via the package
  SELECT bp.booking_id INTO target_booking_id
  FROM booking_packages bp
  WHERE bp.id = COALESCE(NEW.package_id, OLD.package_id);

  IF target_booking_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE bookings SET
    total_paid = COALESCE((
      SELECT SUM(bpp.amount_paid)
      FROM booking_package_payments bpp
      JOIN booking_packages bp ON bp.id = bpp.package_id
      WHERE bp.booking_id = target_booking_id AND bpp.status = 'paid'
    ), 0),
    next_payment_date = (
      SELECT MIN(bpp.due_date)
      FROM booking_package_payments bpp
      JOIN booking_packages bp ON bp.id = bpp.package_id
      WHERE bp.booking_id = target_booking_id AND bpp.status IN ('pending', 'due') AND bpp.due_date IS NOT NULL
    ),
    next_payment_amount = (
      SELECT bpp.amount
      FROM booking_package_payments bpp
      JOIN booking_packages bp ON bp.id = bpp.package_id
      WHERE bp.booking_id = target_booking_id AND bpp.status IN ('pending', 'due') AND bpp.due_date IS NOT NULL
      ORDER BY bpp.due_date ASC LIMIT 1
    )
  WHERE id = target_booking_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_booking_package_payment_summary
  AFTER INSERT OR UPDATE OR DELETE ON booking_package_payments
  FOR EACH ROW EXECUTE FUNCTION refresh_booking_package_payment_summary();

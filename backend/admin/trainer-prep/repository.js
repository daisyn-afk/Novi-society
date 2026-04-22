import { query } from "../db.js";

function normalizeSupplyItem(item) {
  return {
    id: item.id,
    item_name: item.item_name,
    purchase_type: item.purchase_type,
    qty: item.qty,
    sort_order: item.sort_order
  };
}

export async function listSupplyLists() {
  const { rows: lists } = await query(
    `select id, name
     from public.trainer_prep_supply_lists
     order by name asc`
  );
  if (!lists.length) return [];

  const listIds = lists.map((l) => l.id);
  const { rows: items } = await query(
    `select id, supply_list_id, item_name, purchase_type, qty, sort_order
     from public.trainer_prep_supply_items
     where supply_list_id = any($1::uuid[])
     order by sort_order asc, created_at asc`,
    [listIds]
  );

  const itemsByList = new Map();
  for (const item of items) {
    const arr = itemsByList.get(item.supply_list_id) || [];
    arr.push(normalizeSupplyItem(item));
    itemsByList.set(item.supply_list_id, arr);
  }

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    items: itemsByList.get(list.id) || []
  }));
}

export async function createSupplyList({ name, items = [] }) {
  const { rows } = await query(
    `insert into public.trainer_prep_supply_lists (name)
     values ($1)
     returning id, name`,
    [name]
  );
  const list = rows[0];

  if (items.length > 0) {
    const values = [];
    const tuples = items.map((item, idx) => {
      const base = idx * 5;
      values.push(list.id, item.item_name, item.purchase_type, item.qty ?? null, idx + 1);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });
    await query(
      `insert into public.trainer_prep_supply_items (supply_list_id, item_name, purchase_type, qty, sort_order)
       values ${tuples.join(", ")}`,
      values
    );
  }

  return list;
}

export async function createSupplyItem({ supplyListId, itemName, purchaseType, qty }) {
  const { rows } = await query(
    `insert into public.trainer_prep_supply_items (supply_list_id, item_name, purchase_type, qty, sort_order)
     values (
       $1,
       $2,
       $3,
       $4,
       coalesce((select max(sort_order) + 1 from public.trainer_prep_supply_items where supply_list_id = $1), 1)
     )
     returning id, supply_list_id, item_name, purchase_type, qty, sort_order`,
    [supplyListId, itemName, purchaseType, qty ?? null]
  );
  return normalizeSupplyItem(rows[0]);
}

export async function getTrainerPrepCourses(courseIds = []) {
  const safeIds = Array.isArray(courseIds) ? courseIds.filter(Boolean) : [];
  if (safeIds.length === 0) return [];

  const { rows: courses } = await query(
    `select c.id as course_id, c.template_id, t.trainer_prep_supply_list_id, t.trainer_prep_supply_item_ids, l.name as supply_list_name
     from public.scheduled_courses c
     join public.template_courses t on t.id = c.template_id
     left join public.trainer_prep_supply_lists l on l.id = t.trainer_prep_supply_list_id
     where c.id = any($1::uuid[])`,
    [safeIds]
  );
  if (!courses.length) return [];

  const listIds = [...new Set(courses.map((c) => c.trainer_prep_supply_list_id).filter(Boolean))];
  const { rows: items } = listIds.length
    ? await query(
      `select id, supply_list_id, item_name, purchase_type, qty, sort_order
       from public.trainer_prep_supply_items
       where supply_list_id = any($1::uuid[])
       order by sort_order asc, created_at asc`,
      [listIds]
    )
    : { rows: [] };

  const { rows: progressRows } = await query(
    `select scheduled_course_id, supply_item_id, is_checked
     from public.trainer_prep_course_progress
     where scheduled_course_id = any($1::uuid[])`,
    [safeIds]
  );

  const progressByCourse = new Map();
  for (const row of progressRows) {
    const map = progressByCourse.get(row.scheduled_course_id) || new Map();
    map.set(row.supply_item_id, Boolean(row.is_checked));
    progressByCourse.set(row.scheduled_course_id, map);
  }

  const itemsByList = new Map();
  for (const item of items) {
    const arr = itemsByList.get(item.supply_list_id) || [];
    arr.push(normalizeSupplyItem(item));
    itemsByList.set(item.supply_list_id, arr);
  }

  return courses.map((course) => {
    const progress = progressByCourse.get(course.course_id) || new Map();
    const selectedIds = new Set(course.trainer_prep_supply_item_ids || []);
    const baseItems = itemsByList.get(course.trainer_prep_supply_list_id) || [];
    const filteredItems = baseItems.filter((item) => selectedIds.has(item.id));
    const supplyItems = filteredItems.map((item) => ({
      ...item,
      is_checked: progress.get(item.id) || false
    }));
    return {
      course_id: course.course_id,
      supply_list_id: course.trainer_prep_supply_list_id,
      supply_list_name: course.supply_list_name || null,
      items: supplyItems
    };
  });
}

export async function setChecklistItemStatus({ scheduledCourseId, supplyItemId, isChecked }) {
  const checkedAt = isChecked ? "now()" : "null";
  await query(
    `insert into public.trainer_prep_course_progress (scheduled_course_id, supply_item_id, is_checked, checked_at)
     values ($1, $2, $3, ${checkedAt})
     on conflict (scheduled_course_id, supply_item_id)
     do update set
       is_checked = excluded.is_checked,
       checked_at = ${checkedAt},
       updated_at = now()`,
    [scheduledCourseId, supplyItemId, Boolean(isChecked)]
  );
}

export async function resetChecklistForCourse(scheduledCourseId) {
  await query(
    `update public.trainer_prep_course_progress
     set is_checked = false,
         checked_at = null,
         updated_at = now()
     where scheduled_course_id = $1`,
    [scheduledCourseId]
  );
}

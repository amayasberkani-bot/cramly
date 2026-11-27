const MODULE_IDS = {
  "Biologie cellulaire": "snv-biologie-cellulaire",
  "Chimie générale": "snv-chimie-generale",
  "Mathématiques 1": "snv-mathematiques-1",
  "Physique 1": "snv-physique-1",
  "Géologie": "snv-geologie",
  "Méthodologie": "snv-methodologie",
};
const MODULE_NAMES = Object.fromEntries(Object.entries(MODULE_IDS).map(([name, id]) => [id, name]));

function requireModuleId(moduleName) {
  const moduleId = MODULE_IDS[moduleName];
  if (!moduleId) throw new Error(`Unknown Cramly module: ${moduleName}`);
  return moduleId;
}

function mapClass(row) {
  return { id: row.id, module: MODULE_NAMES[row.module_id] || row.module_id, day: row.day_of_week, type: row.class_type, startTime: String(row.start_time).slice(0, 5), endTime: String(row.end_time).slice(0, 5), room: row.room || "" };
}

function mapExam(row) {
  return { id: row.id, module: MODULE_NAMES[row.module_id] || row.module_id, type: row.event_type, date: row.event_date, importance: row.importance };
}

export function createStudyRepository(client) {
  if (!client) return null;

  return {
    async ensureProfile(user) {
      const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "";
      const { error } = await client.from("profiles").upsert({ id: user.id, display_name: displayName }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    },

    async loadPlanner(userId) {
      const [classes, exams] = await Promise.all([
        client.from("timetable_entries").select("id,module_id,day_of_week,class_type,start_time,end_time,room").eq("user_id", userId).order("day_of_week").order("start_time"),
        client.from("exam_events").select("id,module_id,event_type,event_date,importance").eq("user_id", userId).order("event_date"),
      ]);
      if (classes.error) throw classes.error;
      if (exams.error) throw exams.error;
      return { timetable: (classes.data || []).map(mapClass), events: (exams.data || []).map(mapExam) };
    },

    async saveClass(userId, entry) {
      const { data, error } = await client.from("timetable_entries").insert({
        user_id: userId, module_id: requireModuleId(entry.module), day_of_week: entry.day,
        class_type: entry.type, start_time: entry.startTime, end_time: entry.endTime, room: entry.room || null,
      }).select("id,module_id,day_of_week,class_type,start_time,end_time,room").single();
      if (error) throw error;
      return mapClass(data);
    },

    async deleteClass(userId, id) {
      const { error } = await client.from("timetable_entries").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },

    async saveExam(userId, event) {
      const { data, error } = await client.from("exam_events").insert({
        user_id: userId, module_id: requireModuleId(event.module), event_type: event.type,
        event_date: event.date, importance: event.importance || "normal",
      }).select("id,module_id,event_type,event_date,importance").single();
      if (error) throw error;
      return mapExam(data);
    },

    async deleteExam(userId, id) {
      const { error } = await client.from("exam_events").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
  };
}

export const studyRepositoryMappings = { modules: MODULE_IDS, moduleId: requireModuleId, mapClass, mapExam };

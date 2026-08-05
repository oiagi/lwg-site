// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_COURSE_CAPACITY,
  formatPublicLocation,
  firstUpcomingSession,
  isPublicCourseEligible,
  isCompanyCodeCourseEligible,
  publicCourseDto,
  reducedLessonCount,
  normalizeAccessCode,
  slotRequiresAccessCode,
  slotAccessCodeMatches,
  publicSlotDto,
  isPublicSlotEligible,
} from '../functions/api/_public-course-booking.js';

const NOW = new Date('2026-08-01T00:00:00Z');

function eligibleCourse(overrides = {}) {
  return {
    public_booking_enabled: true,
    status: 'active',
    group_type: 'group',
    location: 'classroom',
    enrolled_count: 2,
    sessions: [{ scheduled_at: '2026-09-01T10:00:00Z' }, { scheduled_at: '2026-08-15T10:00:00Z' }],
    ...overrides,
  };
}

test('firstUpcomingSession returns earliest future session', () => {
  const course = eligibleCourse();
  assert.equal(firstUpcomingSession(course, NOW).scheduled_at, '2026-08-15T10:00:00Z');
  assert.equal(firstUpcomingSession({ sessions: [] }, NOW), undefined);
  assert.equal(firstUpcomingSession(eligibleCourse(), new Date('2026-10-01T00:00:00Z')), undefined);
});

test('formatPublicLocation', () => {
  assert.equal(
    formatPublicLocation({ location: "teacher's home", location_city: 'Zürich' }),
    "Teacher's home, Zürich"
  );
  assert.equal(formatPublicLocation({ location: "teacher's home" }), "Teacher's home");
  assert.equal(
    formatPublicLocation({
      location: 'company',
      location_company: 'ACME AG',
      location_street: 'Bahnhofstrasse',
      location_street_number: '1',
      location_postal_code: '8001',
      location_city: 'Zürich',
    }),
    'ACME AG, Bahnhofstrasse 1, 8001 Zürich'
  );
  assert.equal(formatPublicLocation({ location: 'classroom' }), 'classroom');
  assert.equal(formatPublicLocation({}), 'Classroom');
});

test('isPublicCourseEligible enforces every gate', () => {
  assert.equal(isPublicCourseEligible(eligibleCourse(), 0, NOW), true);
  assert.equal(
    isPublicCourseEligible(eligibleCourse({ public_booking_enabled: false }), 0, NOW),
    false
  );
  assert.equal(isPublicCourseEligible(eligibleCourse({ status: 'archived' }), 0, NOW), false);
  assert.equal(isPublicCourseEligible(eligibleCourse({ group_type: 'duo' }), 0, NOW), false);
  assert.equal(isPublicCourseEligible(eligibleCourse({ location: 'online' }), 0, NOW), false);
  assert.equal(isPublicCourseEligible(eligibleCourse({ sessions: [] }), 0, NOW), false);
  // capacity: 2 enrolled + 3 pending = 5 = full
  assert.equal(isPublicCourseEligible(eligibleCourse(), 3, NOW), false);
  assert.equal(isPublicCourseEligible(eligibleCourse(), 2, NOW), true);
});

test('isCompanyCodeCourseEligible requires flag and access code, allows any location', () => {
  const course = eligibleCourse({
    public_booking_enabled: false,
    company_code_booking_enabled: true,
    access_code: 'ZH-2026',
    location: 'online',
  });
  assert.equal(isCompanyCodeCourseEligible(course, 0, NOW), true);
  assert.equal(isCompanyCodeCourseEligible({ ...course, access_code: null }, 0, NOW), false);
  assert.equal(
    isCompanyCodeCourseEligible({ ...course, company_code_booking_enabled: false }, 0, NOW),
    false
  );
});

test('publicCourseDto computes spots and sessions remaining', () => {
  const dto = publicCourseDto(
    eligibleCourse({ sessions_total: 10, sessions_completed: 4 }),
    1,
    NOW
  );
  assert.equal(dto.kind, 'existing_course');
  assert.equal(dto.capacity, PUBLIC_COURSE_CAPACITY);
  assert.equal(dto.spots_remaining, 2); // 5 - (2 enrolled + 1 pending)
  assert.equal(dto.sessions_remaining, 6); // max(2 upcoming, 10 - 4)
  assert.equal(dto.first_session_at, '2026-08-15T10:00:00Z');
  assert.equal(dto.currency, 'CHF');
  assert.equal(dto.access_code_required, false);
});

test('publicCourseDto price per person falls back to per-session split', () => {
  const base = eligibleCourse({ price_per_session: 100 });
  assert.equal(publicCourseDto(base, 0, NOW).price_per_person_per_60min, 100 / 5);
  assert.equal(
    publicCourseDto(eligibleCourse({ price_per_session: 100, group_type: 'duo' }), 0, NOW)
      .price_per_person_per_60min,
    50
  );
  assert.equal(
    publicCourseDto(
      eligibleCourse({ price_per_person_per_60min: 42, price_per_session: 100 }),
      0,
      NOW
    ).price_per_person_per_60min,
    42
  );
});

test('reducedLessonCount prorates below minimum group size', () => {
  assert.equal(reducedLessonCount(9, 1, 3), 3);
  assert.equal(reducedLessonCount(9, 2, 3), 6);
  assert.equal(reducedLessonCount(9, 3, 3), 9); // at minimum → full
  assert.equal(reducedLessonCount(9, 5, 3), 9); // above minimum → full
  assert.equal(reducedLessonCount(10, 1, 3), 3); // floor(10/3)
  assert.equal(reducedLessonCount(1, 1, 3), 1); // never below 1
  assert.equal(reducedLessonCount(null, 1, 3), null);
  assert.equal(reducedLessonCount(0, 1, 3), null);
});

test('access code normalization and matching', () => {
  assert.equal(normalizeAccessCode(' zh 20-26 '), 'ZH20-26');
  assert.equal(normalizeAccessCode(''), null);
  assert.equal(normalizeAccessCode(null), null);
  assert.equal(slotRequiresAccessCode({ access_code: 'abc' }), true);
  assert.equal(slotRequiresAccessCode({ access_code: '  ' }), false);
  assert.equal(slotRequiresAccessCode(undefined), false);
  assert.equal(slotAccessCodeMatches({ access_code: 'ZH-26' }, 'zh-26'), true);
  assert.equal(slotAccessCodeMatches({ access_code: 'ZH-26' }, 'wrong'), false);
  assert.equal(slotAccessCodeMatches({ access_code: null }, 'anything'), true); // no code set
});

test('publicSlotDto builds schedule text and reduced-lesson previews', () => {
  const dto = publicSlotDto(
    {
      id: 's1',
      weekday: 3,
      start_time: '12:15:00',
      end_time: '13:05:00',
      sessions_total: 9,
      minimum_students: 3,
      capacity: 5,
      allow_reduced_lessons: true,
      course_type: 'German course',
      location: 'online',
    },
    2
  );
  assert.equal(dto.kind, 'planned_slot');
  assert.equal(dto.schedule_text, 'Wednesdays 12:15-13:05');
  assert.equal(dto.spots_remaining, 3);
  assert.equal(dto.interested_count, 2);
  assert.equal(dto.reduced_lessons_if_one, 3);
  assert.equal(dto.reduced_lessons_if_two, 6);
  assert.equal(dto.timezone, 'Europe/Zurich');
});

test('isPublicSlotEligible', () => {
  assert.equal(isPublicSlotEligible({ public_booking_enabled: true, status: 'active' }), true);
  assert.equal(isPublicSlotEligible({ public_booking_enabled: true, status: 'draft' }), false);
  assert.equal(isPublicSlotEligible({ public_booking_enabled: false, status: 'active' }), false);
});

/// <reference path="lp.ts" />
/// <reference path="scheduling.ts" />

const minDuration = 2; // assign only slots of 2 consecutive hours (or more)

// duration in hours of each timeslice; they are all the same (1 hour) in this
// example to make the output easier to read, but the problem can handle slices
// of different durations
const duration = [
  1, //  0- 1
  1, //  1- 2
  1, //  2- 3
  1, //  3- 4
  1, //  4- 5
  1, //  5- 6
  1, //  6- 7
  1, //  7- 8
  1, //  8- 9
  1, //  9-10
  1, // 10-11
  1, // 11-12
  1, // 12-13
  1, // 13-14
  1, // 14-15
  1, // 15-16
  1, // 16-17
  1, // 17-18
  1, // 18-19
  1, // 19-20
  1, // 20-21
  1, // 21-22
  1, // 22-23
  1, // 23-24
];

const expected = [ // expected number of riders in each timeslice
  0, //  0- 1
  0, //  1- 2
  0, //  2- 3
  0, //  3- 4
  0, //  4- 5
  0, //  5- 6
  0, //  6- 7
  0, //  7- 8
  0, //  8- 9
  0, //  9-10
  0, // 10-11
  0, // 11-12
  2, // 12-13
  2, // 13-14
  1, // 14-15
  0, // 15-16
  0, // 16-17
  0, // 17-18
  2, // 18-19
  3, // 19-20
  4, // 20-21
  4, // 21-22
  2, // 22-23
  0, // 23-24
];

// in this example there is no additional requirement on the assignment of bike
// riders, while (at night) the system will require at least some scooter riders
const expectedOfType = {
  'bike': [
    0, //  0- 1
    0, //  1- 2
    0, //  2- 3
    0, //  3- 4
    0, //  4- 5
    0, //  5- 6
    0, //  6- 7
    0, //  7- 8
    0, //  8- 9
    0, //  9-10
    0, // 10-11
    0, // 11-12
    0, // 12-13
    0, // 13-14
    0, // 14-15
    0, // 15-16
    0, // 16-17
    0, // 17-18
    0, // 18-19
    0, // 19-20
    0, // 20-21
    0, // 21-22
    0, // 22-23
    0, // 23-24
  ],
  'scooter': [
    0, //  0- 1
    0, //  1- 2
    0, //  2- 3
    0, //  3- 4
    0, //  4- 5
    0, //  5- 6
    0, //  6- 7
    0, //  7- 8
    0, //  8- 9
    0, //  9-10
    0, // 10-11
    0, // 11-12
    0, // 12-13
    0, // 13-14
    0, // 14-15
    0, // 15-16
    0, // 16-17
    0, // 17-18
    1, // 18-19
    2, // 19-20
    2, // 20-21
    2, // 21-22
    1, // 22-23
    0, // 23-24
  ],
};

const riderType = [
  'bike',
  'bike',
  'scooter',
  'scooter',
];

// for each timeslice, if the rider is available
const available = [
  [true, true,  false, false], //  0- 1
  [true, true,  false, false], //  1- 2
  [true, true,  false, false], //  2- 3
  [true, true,  false, false], //  3- 4
  [true, true,  false, false], //  4- 5
  [true, true,  false, false], //  5- 6
  [true, true,  false, false], //  6- 7
  [true, true,  false, false], //  7- 8
  [true, true,  false, false], //  8- 9
  [true, true,  false, false], //  9-10
  [true, true,  false, false], // 10-11
  [true, true,  false, false], // 11-12
  [true, true,  false, false], // 12-13
  [true, true,  true,  false], // 13-14
  [true, false, true,  false], // 14-15
  [true, false, false, false], // 15-16
  [true, false, false, false], // 16-17
  [true, false, false, false], // 17-18
  [true, false, false, true ], // 18-19
  [true, false, true,  true ], // 19-20
  [true, true,  true,  true ], // 20-21
  [true, true,  true,  true ], // 21-22
  [true, false, true,  false], // 22-23
  [true, false, true,  false], // 23-24
];

// for each rider, hours that are going to be paid regardless of the actual assignments
const guaranteed = [
  6,
  4,
  4,
  0,
];

const linProgram = scheduling.makeLP(
  duration,
  expected,
  expectedOfType,
  riderType,
  available,
  guaranteed,
  minDuration,
);

console.log(linProgram.export());

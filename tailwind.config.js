// module.exports = {
//   theme: {
//     extend: {
//       colors: {
//         tedxred: '#EB0028',
//         tedxpurple: '#291e3e',
//         tedxblue: '#3772FF',
//         tedxdark: '#17131C',
//         tedxdarker: '#20182C'
//       },
//     },
//   },
// }
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}', // Scan all JS/TS React source files inside src
    './public/index.html'          // Scan static index.html in public folder
  ],
  theme: {
    extend: {
      colors: {
        tedxred: '#EB0028',
        tedxpurple: '#291e3e',
        tedxblue: '#3772FF',
        tedxdark: '#17131C',
        tedxdarker: '#20182C'
      },
    },
  },
};

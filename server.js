const express = require('express');
const path = require('path');

const app = express();
const distPath = path.join(__dirname, 'dist/admin-dashboard/browser');

app.use(express.static(distPath));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname , 'dist/admin-dashboard/browser')));

app.get('/',(req , res)=>{
   res.sendFile(path.join(__dirname , 'dist/admin-dashboard/browser/index.html'))
})

const PORT = process.env.PORT || 4000;
app.listen(PORT , ()=>{
    console.log(`Server running on port ${PORT}`);
});

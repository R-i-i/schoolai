from fastapi import FastAPI, File, UploadFile
app=FastAPI()
@app.post('/ocr')
async def ocr(file:UploadFile=File(...)):
    return {'text':'(stub ocr)'}

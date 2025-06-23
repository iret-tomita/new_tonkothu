import json
import boto3
import os
import os.path
from PIL import Image
from io import BytesIO
<<<<<<< HEAD
from datetime import datetime
=======
>>>>>>> test_tonkothu0623

# --- AWS クライアント/リソースの初期化 ---
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    SQSイベントをトリガーに呼び出されるLambdaハンドラ。
    受け取ったメッセージ内にあるファイル名を元に画像を取得し、
    サムネイルの生成・切り出し後にS3とDynamoDBへアップロードする。
    """

<<<<<<< HEAD
    # Lambda 環境変数の読み込み - ここを修正
    # 元画像が入っているS3バケット
    BUCKET_NAME = os.environ['main_picture_bucket'] 
    # サムネイルを保存するS3バケット
    THUMBNAIL_BUCKET_NAME = os.environ['samneil_picture_bucket'] 
    # DynamoDBテーブル名
    PHOTO_TABLE_NAME = os.environ['picture_table'] 
=======
    # Lambda 環境変数の読み込み
    BUCKET_NAME = os.environ['BUCKET_NAME'] # 元画像が入っているS3バケット
    THUMBNAIL_BUCKET_NAME = os.environ['THUMBNAIL_BUCKET_NAME'] # サムネイルを保存するS3バケット
    PHOTO_TABLE_NAME = os.environ['PHOTO_TABLE_NAME'] # DynamoDBテーブル名
>>>>>>> test_tonkothu0623

    # DynamoDBテーブルオブジェクトを取得
    table = dynamodb.Table(PHOTO_TABLE_NAME)

    # SQSからのイベントには複数のレコード（メッセージ）が含まれる可能性があるためループ処理
    for record in event['Records']:
        # SQSメッセージのBodyをJSONとして読み込み
        body = json.loads(record['body'])

        # メッセージ内に含まれている情報を取得
        photo_id = body['photo_id']
        file_name = body['file_name']

        # S3から元画像を取得
        response = s3.get_object(Bucket=BUCKET_NAME, Key=file_name)
        original_img = response['Body'].read()

        # 拡張子判定してPillow用フォーマットを決定
        _, ext = os.path.splitext(file_name)
        ext = ext.lower()
        out_format = convert_ext_to_pillow_format(ext)

        # Pillowで画像を読み込み
        image = Image.open(BytesIO(original_img))

        # JPEGに変換するとき、RGBAならばRGBへ変換（透明背景を除去）
        if out_format == "JPEG" and image.mode == "RGBA":
            image = image.convert("RGB")

        # サムネイルサイズ(200,200)にまず縮小（アスペクト比維持）
        image.thumbnail((200, 200)) 
        width, height = image.size

        # 縦か横のいずれかが 200 px 未満の場合は、足りない分だけ拡大
        #     例: すでに小さい画像(50x100 など)を 200 まで拡大
        if width < 200 or height < 200:
            scale_w = 200 / width  if width  < 200 else 1
            scale_h = 200 / height if height < 200 else 1
            scale = max(scale_w, scale_h)
            new_w = int(width * scale)
            new_h = int(height * scale)

            # PILのLANCZOSフィルタでリサイズ（高品質）
            image = image.resize((new_w, new_h), Image.LANCZOS)
            width, height = new_w, new_h

        # 横幅と高さともに 200 px 以上になったら、中央を 200 x 200 に切り出す
        left = (width - 200) / 2
        top = (height - 200) / 2
        right = left + 200
        bottom = top + 200
        image = image.crop((left, top, right, bottom))

        # 生成したサムネイル画像をバッファに書き込み
        buffer = BytesIO()
        image.save(buffer, format=out_format)
        buffer.seek(0)

        # サムネイル画像を別バケットにアップロード
        thumbnail_name = f"thumbnail-{file_name}"
<<<<<<< HEAD
        try:
            s3.put_object(
                Bucket=THUMBNAIL_BUCKET_NAME,
                Key=thumbnail_name,
                Body=buffer,
                ContentType=f"image/{out_format.lower()}"
            )
            print(f"Successfully uploaded thumbnail {thumbnail_name} to {THUMBNAIL_BUCKET_NAME}")
        except Exception as e:
            print(f"Error uploading thumbnail {thumbnail_name}: {e}")
            raise

        # DynamoDB にメタデータ保存
        try:
            table.put_item(
                Item={
                    'picture_Id': photo_id,              # SQSメッセージからの photo_id
                    'picture_names': file_name,          # 元画像のファイル名
                    '3bucket_name': THUMBNAIL_BUCKET_NAME, # サムネイルが保存されたバケット名
                    'upload_date': datetime.now().isoformat() # 現在の日時
                }
            )
            print(f"Successfully saved metadata for picture_Id {photo_id} to {PHOTO_TABLE_NAME}")
        except Exception as e:
            print(f"Error saving metadata for picture_Id {photo_id}: {e}")
            raise
=======
        # S3にアップロード
        
            
            
            
        

        # DynamoDB にメタデータ保存
        
            
            
            
        
>>>>>>> test_tonkothu0623

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps('画像処理成功')
    }


def convert_ext_to_pillow_format(ext: str) -> str:
    """
    拡張子からPillow用の出力フォーマットへ変換する。
    対応拡張子以外はJPEGとして扱う。
    """
    if ext in [".jpg", ".jpeg"]:
        return "JPEG"
    elif ext == ".png":
        return "PNG"
    elif ext == ".gif":
        return "GIF"
    elif ext == ".bmp":
        return "BMP"
    elif ext in [".tif", ".tiff"]:
        return "TIFF"
    elif ext == ".webp":
        return "WEBP"
    else:
        return "JPEG"
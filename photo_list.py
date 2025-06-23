import boto3
import os
import json

# --- DynamoDB オブジェクトを初期化 ---
dynamodb = boto3.resource("dynamodb")

def lambda_handler(event, context):
    """
    DynamoDBテーブルから写真データを取得し、
    サムネイルのURL（パブリック）とオリジナル画像の署名付きURLを生成して返すLambda関数。

    1) 最大50件まで scan() でデータを取得
    2) 各データからサムネイルURL、オリジナル画像の署名付きURLを作成
    3) 生成したリストをJSON形式で返却

    """

    # --- (1) 環境変数の取得 ---
    PHOTO_TABLE_NAME = os.environ['picture_table']           # DynamoDBテーブル名
    THUMBNAIL_BUCKET_NAME = os.environ['samneil_picture_bucket'] # サムネイル用S3バケット
    ORIGINAL_BUCKET_NAME = os.environ['main_picture_bucket'] # オリジナル画像を保管しているS3バケット


    # --- (2) 署名付きURL生成用のS3クライアント ---
    s3 = boto3.client('s3') # generate_presigned_url には client を使用

    # --- (3) DynamoDBテーブルオブジェクトを取得 ---
    table = dynamodb.Table(PHOTO_TABLE_NAME)

     if 'Records' not in event or not isinstance(event['Records'], list):
        print("400 Error: Invalid SQS event format. 'Records' key missing or not a list.")
        return {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "message": "リクエスト形式が不正です。SQSイベントの形式を確認してください。",
                "error": "Invalid SQS event structure"
            }),
        }

    try:
        # --- (4) テーブルのデータをスキャンして最大50件取得 ---
        response = table.scan(
            Limit=50 # 最大50件取得
        )
        items = response.get('Items', [])
        
        # --- (5) もし取得データが無ければ空の配列を返す ---
        if not items:
            print("DynamoDBから取得できるアイテムがありませんでした。")
            return {
                "statusCode": 200,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"thumbnails": []}),
            }

        # --- (6) 取得結果を格納するリストを用意 ---
        thumbnails = []

        for item in items: # <--- あなたが質問された、このループでitemsを処理します
            # DynamoDBの項目名に合わせて修正
            picture_id = item.get('picture_Id')                     # 写真ID (プライマリキー)
            original_file_name = item.get('picture_names')          # オリジナル画像のファイル名
            thumbnail_bucket = item.get('3bucket_name')             #データとして取得
            
            # サムネイルのファイル名を、元のファイル名から規則的に生成
            thumbnail_file_name = f"thumbnail-{original_file_name}" if original_file_name else None

            # サムネイル名やオリジナルファイル名が無い場合はスキップ
            if not picture_id or not original_file_name or not thumbnail_file_name:
                print(f"必須項目が不足しているアイテムをスキップします: {item}")
                continue

            # --- (7) サムネイル画像のパブリックURL生成 ---
            aws_region = os.environ.get('AWS_REGION', 'ap-northeast-1') # 例: 東京リージョン
            thumbnail_url = (
                f"https://{THUMBNAIL_BUCKET_NAME}.s3.{aws_region}.amazonaws.com/{thumbnail_file_name}"
            )

            # --- (8) オリジナル画像の署名付きURLを生成 (期限付き) ---
            presigned_original = s3.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': ORIGINAL_BUCKET_NAME,
                    'Key': original_file_name # オリジナル画像のファイル名を使用
                },
                ExpiresIn=3600  # 有効期限1時間 (秒単位)
            )

            # --- (9) サムネイルデータとしてまとめて配列に追加 ---
            thumbnails.append(
                {
                    'photo_id': picture_id,
                    'thumbnail_url': thumbnail_url,
                    'original_url': presigned_original, # フロントエンドで original_url として利用
                    'likes': item.get('likes', 0) # 'likes' アトリビュートがあれば取得、なければ0
                }
            )

        # --- (10) 取得したサムネイルリストをJSON形式で返却 ---
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*", # CORS対応
                "Content-Type": "application/json"
            },
            "body": json.dumps({"thumbnails": thumbnails}),
        }

    except Exception as e:
        # --- (エラー処理) 例外発生時のログ出力とエラー応答 ---
        print(f"画像一覧取得エラー: {e}")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "message": "画像一覧取得に失敗しました",
                "error": str(e)
            }),
        }
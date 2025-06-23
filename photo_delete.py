import json
import boto3
import os

def lambda_handler(event, context):
    try:
        #環境変数の名前をリソース設計書や他のファイルと同様に変更してほしい
        #SQSの作成が出来次第SQSキューのURLを変更して欲しい（コピペして入れ替える）
        BUCKET_NAME = os.environ['main_picture_bucket']
        PHOTO_TABLE_NAME = os.environ['picture_table']
        PICTURE_QUEUE_URL = os.environ['SQSキューのURL']

        # パスパラメータの取得（API Gateway → Lambda event['pathParameters']）
        #今リクエストパラメータでphoto_idを取得しているけど他のファイル同様Bodyで取得するように変更する
        path_params = event.get('pathParameters') or {}
        photo_id = path_params.get('photo_id')
        file_name = path_params.get('file_name')

        if not photo_id or not file_name:
            return {
                'statusCode': 400,
                'body': json.dumps('Missing photo_id or file_name')
            }

        # S3ファイル削除
        s3 = boto3.client('s3')
        s3.delete_object(Bucket=BUCKET_NAME, Key=file_name)

        #S3ファイルの消去（サムネイルバケット）

        # DynamoDBレコード削除
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(PHOTO_TABLE_NAME)
        table.delete_item(Key={'photo_id': photo_id})

        # SQS通知（任意）
        sqs = boto3.client('sqs')
        sqs.send_message(
            QueueUrl=PICTURE_QUEUE_URL,
            MessageBody=json.dumps({
                'action': 'delete',
                'photo_id': photo_id,
                'file_name': file_name
            })
        )

        return {
            'statusCode': 200,
            'body': json.dumps(f'{file_name} deleted successfully')
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }

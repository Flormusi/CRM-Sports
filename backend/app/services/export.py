from fastapi import HTTPException, status
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text
import io
from typing import List, Dict, Any
import csv

class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_to_csv(self, query: str, params: Dict[str, Any] = None) -> bytes:
        try:
            results = self.db.execute(text(query), params or {}).fetchall()
            if not results:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No data found to export"
                )

            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow([desc[0] for desc in results[0].cursor_description])
            
            # Write data
            writer.writerows(results)
            
            return output.getvalue().encode('utf-8')

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error exporting data: {str(e)}"
            )

    def export_to_excel(self, query: str, params: Dict[str, Any] = None) -> bytes:
        try:
            df = pd.read_sql(query, self.db.connection(), params=params or {})
            if df.empty:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No data found to export"
                )

            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                df.to_excel(writer, sheet_name='Data', index=False)
            
            return output.getvalue()

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error exporting data: {str(e)}"
            )
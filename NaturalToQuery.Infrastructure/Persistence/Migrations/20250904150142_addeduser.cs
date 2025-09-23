using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NaturalToQuery.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class addeduser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UserInfoId",
                table: "Profiles",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserInfoId1",
                table: "Profiles",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UserInfos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ApiKey = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Mode = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LastUpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserInfos", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Profiles_UserInfoId",
                table: "Profiles",
                column: "UserInfoId");

            migrationBuilder.CreateIndex(
                name: "IX_Profiles_UserInfoId1",
                table: "Profiles",
                column: "UserInfoId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Profiles_UserInfos_UserInfoId",
                table: "Profiles",
                column: "UserInfoId",
                principalTable: "UserInfos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Profiles_UserInfos_UserInfoId1",
                table: "Profiles",
                column: "UserInfoId1",
                principalTable: "UserInfos",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Profiles_UserInfos_UserInfoId",
                table: "Profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_Profiles_UserInfos_UserInfoId1",
                table: "Profiles");

            migrationBuilder.DropTable(
                name: "UserInfos");

            migrationBuilder.DropIndex(
                name: "IX_Profiles_UserInfoId",
                table: "Profiles");

            migrationBuilder.DropIndex(
                name: "IX_Profiles_UserInfoId1",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "UserInfoId",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "UserInfoId1",
                table: "Profiles");
        }
    }
}
